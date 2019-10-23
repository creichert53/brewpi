const r = require('rethinkdb')
const moment = require('moment-timezone')
const CronJob = require('cron').CronJob

function Temperatures() {
  // keep track of the recipe
  this.recipeId = null
  this.setRecipeId = (recipeId) => {
    this.recipeId = recipeId
  }
  this.value = {
    temp1: null,
    temp2: null,
    temp3: null
  }

  // record a new temperature in the database
  this.addTemp = (stepId, timeInSeconds) => {
    if (this.recipeId && Object.values(this.value).reduce((acc,val) => acc += val === null ? 1 : 0, 0) !== 3) {
      r.connect({db: 'brewery'}).then(conn => {
        r.table('temperatures').insert({
          stepId: stepId,
          recipeId: this.recipeId,
          time: moment().add(500, 'ms').startOf('second').unix(),
          brewTime: timeInSeconds,
          complete: false,
          unix: moment().valueOf(),
          ...this.value
        }).run(conn).finally(() => {
          conn.close()
        })
      })
    }
  }

  // Clean up old Temp Values (> 24 hours old without a complete flag)
  new CronJob({
    cronTime: '0 0 * * * *',
    onTick: () => {
      r.connect({db: 'brewery'}).then(conn => {
        r.table('temperatures')
          .between([false, r.minval], [false, moment().subtract(1, 'day').valueOf()], { index: 'complete_time' })
          .delete()
          .run(conn)
          .finally(() => {
            conn.close()
          })
      })
    },
    runOnInit: true,
    start: true
  })
}