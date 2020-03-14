const _ = require('lodash')
const r = require('rethinkdb')
const moment = require('moment-timezone')

const bootstrapDatabase = () => {
  return new Promise((resolve, reject) => {
    r.connect({db: 'brewery'}).then(conn => {
      var all = []
      r.dbList().contains('test')
        .do(dbExists => r.branch(dbExists, r.dbDrop('test'), { dbs_dropped: 0 }))
        .do(() => r.dbList().contains('brewery'))
        .do(dbExists => r.branch(dbExists, { dbs_created: 0 }, r.dbCreate('brewery')))
        .do(() => r.db('brewery').tableList().contains('reboots'))
        .do(tableExists => r.branch(tableExists, { tables_created: 0 }, r.db('brewery').tableCreate('reboots')))
        .do(() => r.db('brewery').tableList().contains('temperatures'))
        .do(tableExists => (
          r.branch(
            tableExists,
            { tables_created: 0 },
            r.db('brewery').tableCreate('temperatures')
              .do(() => r.db('brewery').table('temperatures').indexCreate('recipeId'))
              .do(() => r.db('brewery').table('temperatures').indexWait('recipeId'))
              .do(() => r.db('brewery').table('temperatures').indexCreate('complete'))
              .do(() => r.db('brewery').table('temperatures').indexWait('complete'))
              .do(() => r.db('brewery').table('temperatures').indexCreate('time'))
              .do(() => r.db('brewery').table('temperatures').indexWait('time'))
          )
        ))
        .do(() => r.db('brewery').tableList().contains('store'))
        .do(tableExists => (
          r.branch(
            tableExists,
            { tables_created: 0 },
            r.db('brewery').tableCreate('store').do(() => r.db('brewery').table('store').insert({ id: 'store' }))
          )
        ))
        .run(conn).then(() => (
          r.db('brewery').table('temperatures').indexList().contains('recipe_complete_time').run(conn)
        )).then(exists => (
          r.branch(
            exists,
            { index_created: 0 },
            r.db('brewery').table('temperatures').indexCreate('recipe_complete_time', [r.row('recipeId'), r.row('complete'), r.row('time')])
          ).run(conn)
        )).then(() => (
          r.db('brewery').table('temperatures').indexList().contains('complete_time').run(conn)
        )).then(exists => (
          r.branch(
            exists,
            { index_created: 0 },
            r.db('brewery').table('temperatures').indexCreate('complete_time', [r.row('complete'), r.row('time')])
          ).run(conn)
        )).then(() => (
          r.db('brewery').table('temperatures').indexWait('recipe_complete_time').run(conn)
        )).then(() => (
          r.db('brewery').table('temperatures').indexWait('complete_time').run(conn)
        )).then(results => {
          conn.close()
          resolve(results)
        })
    }).catch(err => {
      reject(err)
    })
  })
}

const removeStaleTimeData = () => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures')
      .between([false, r.minval], [false, moment().subtract(1, 'day').unix()], { index: 'complete_time' })
      .delete()
      .run(conn)
      .finally(results => {
        conn.close()
      })
  })
}

const completeTimeData = (recipeId) => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures')
      .between([recipeId, false, r.minval], [recipeId, false, r.maxval], { index: 'recipe_complete_time' })
      .update({ complete: true })
      .run(conn)
      .finally(() => {
        conn.close()
      })
  })
}

const insertTime = (options) => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures').insert({
      ...options,
      time: moment().add(500, 'ms').startOf('second').unix(),
      complete: false,
      unix: moment().valueOf()
    }).run(conn).finally(() => {
      conn.close()
    })
  })
}

const getRecipeTemps = (recipeId) => {
  return new Promise((resolve, reject) => {
    if (recipeId) {
      r.connect({db: 'brewery'}).then(conn => {
        r.branch(r.table('temperatures').getAll(recipeId, {index: 'recipeId'}).count().gt(0),
          r.table('temperatures')
            .between(
              [recipeId || '', false, r.db('brewery').table('temperatures').max({index: 'time'})('time').sub(30 * 60)],
              [recipeId || '', false, r.maxval],
              { index: 'recipe_complete_time' }
            )
            .orderBy({ index: 'recipe_complete_time' })
            .coerceTo('array'),
          []
        ).run(conn).then(temps => {
          conn.close()
          resolve(temps)
        }).catch(err => {
          conn.close()
          reject(err)
        })
      })
    } else {
      resolve([])
    }
  })
}


const removeIncompleteTemps = () => {
  // remove any temperatures from the database that are not complete
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures')
      .between([false, r.minval], [false, r.maxval], { index: 'complete_time' })
      .delete()
      .run(conn)
      .finally(() => {
        conn.close()
      })
  })
}

const getStoreFromDatabase = () => {
  var store = null
  return new Promise(function(resolve, reject) {
    r.connect({db: 'brewery'}).then(conn => {
      // first make sure the database has all the necessary tables and indeces
      r.table('store').get('store').coerceTo('object').run(conn).then(result => {
        store = result
        return getRecipeTemps(_.get(store, 'recipe.id', null))
      }).then(temperatureArray => {
        conn.close()
        resolve({
          store: store,
          temperatureArray: _.takeRight(temperatureArray, 30 * 60)
        })
      }).catch(err => {
        console.log(err)
        conn.close()
        reject()
      })
    })
  })
}

// Update the store on the server
const updateStore = (store) => {
  return new Promise(function(resolve, reject) {
    r.connect({db: 'brewery'}).then(conn => {
      const s = Object.assign({}, store)
      s.id = 'store'
      r.table('store').insert(s, { conflict: 'replace' }).run(conn).then(results => {
        conn.close()
        resolve(store)
      }).catch(err => {
        conn.close()
        reject()
      })
    })
  })
}

// Emit any new temperatures inserted into the database up to all frontends
const emitTemperatures = (io) => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures').changes().run(conn).then(cursor => {
      cursor.on('error', err => {
        console.error(err)
      })
      cursor.on('data', data => {
        if (data && data.new_val) {
          io.emit('temp array', data.new_val)
        }
      })
    })
  })
}

module.exports = {
  bootstrapDatabase,
  removeStaleTimeData,
  completeTimeData,
  insertTime,
  getRecipeTemps,
  removeIncompleteTemps,
  getStoreFromDatabase,
  updateStore,
  emitTemperatures
}