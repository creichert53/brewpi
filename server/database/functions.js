const { get, takeRight } = require('lodash')
const r = require('rethinkdb')
const moment = require('moment-timezone')
const { EventEmitter } = require('events')
const logger = require('../service/logger')
const redis = require('redis')
const Promise = require('bluebird')

Promise.promisifyAll(redis.RedisClient.prototype)

module.exports.bootstrapDatabase = () => {
  return new Promise(async (resolve, reject) => {
    // Open connection to database
    try {
      // Create resources or make sure that tables, table indexes, and default store exist already.
      let conn = await r.connect({db: 'brewery'})
      await r.dbList().contains('test')
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
            r.db('brewery').tableCreate('store').do(() => r.db('brewery').table('store').insert(require('./defaultStore.json')))
          )
        ))
        .run(conn)
      let tempsTable = r.db('brewery').table('temperatures')

      // Create compound secondary index
      let recipeCompleteTimeExists = await tempsTable.indexList().contains('recipe_complete_time').run(conn)
      if (!recipeCompleteTimeExists) await tempsTable.indexCreate('recipe_complete_time', [r.row('recipeId'), r.row('complete'), r.row('time')]).run(conn)
      await tempsTable.indexWait('recipe_complete_time').run(conn)

      // And a second compound secondary index
      let completeTimeExists = await tempsTable.indexList().contains('complete_time').run(conn)
      if (!completeTimeExists) await tempsTable.indexCreate('complete_time', [r.row('complete'), r.row('time')]).run(conn)
      await tempsTable.indexWait('complete_time').run(conn)

      // Get the save store and then close the connection to rethink
      const store = await r.db('brewery').table('store').get('store').coerceTo('object').run(conn)
      await conn.close()
  
      // Create and populate the redis in memory store as well. All data will be store while running until periodically dumped to the rethinkdb disk store.
      let client = redis.createClient()
      if (!(await client.existsAsync('store'))) await client.setAsync('store', JSON.stringify(store))
      if (!(await client.existsAsync('temps'))) await client.setAsync('temps', JSON.stringify({ temp1: 0.0, temp2: 0.0, temp3: 0.0 }))
      if (!(await client.existsAsync('time'))) await client.setAsync('time', JSON.stringify({ totalTime: 0, stepTime: 0, remainingTime: 0 }))
      client.quit()
      resolve('Databases bootsrapped successfully!')
    } catch (error) {
      logger.error(error)
      reject(error)
    }
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
