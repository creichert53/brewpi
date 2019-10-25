const r = require('rethinkdb')
const moment = require('moment-timezone')

module.exports.completeTimeData = () => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures')
      .between([false, r.minval], [false, moment().subtract(1, 'day').valueOf()], { index: 'complete_time' })
      .delete()
      .run(conn)
      .finally(() => {
        conn.close()
      })
  })
}

module.exports.insertTime = (options) => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('temperatures').insert({
      stepId: options.stepId,
      recipeId: options.recipeId,
      time: moment().add(500, 'ms').startOf('second').unix(),
      brewTime: options.timeInSeconds,
      complete: false,
      unix: moment().valueOf(),
      ...options.temps
    }).run(conn).finally(() => {
      conn.close()
    })
  })
}

module.exports.getRecipeTemps = (recipeId) => {
  return new Promise((resolve, reject) => {
    r.connect({db: 'brewery'}).then(conn => {
      r.table('temperatures')
        .between([recipeId || '', false, r.minval], [recipeId || '', false, r.maxval], { index: 'recipe_complete_time' })
        .orderBy({ index: 'recipe_complete_time' })
        .coerceTo('array')
        .run(conn)
        .then(temps => {
          conn.close()
          resolve(temps)
        }).catch(err => {
          conn.close()
          reject(err)
        })
    })
  })
}

module.exports.removeIncompleteTemps = () => {
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
