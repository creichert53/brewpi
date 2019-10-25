const r = require('rethinkdb')
const moment = require('moment-timezone')
const CronJob = require('cron').CronJob
const dbFunctions = require('../database/functions')

module.exports = class Temperatures {
  constructor() {

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
        dbFunctions.insertTime({
          stepId: stepId,
          timeInSeconds: timeInSeconds,
          recipeId: this.recipeId,
          temps: this.value
        })
      }
    }

    // Clean up old Temp Values (> 24 hours old without a complete flag)
    new CronJob({
      cronTime: '0 0 * * * *',
      onTick: () => {
        dbFunctions.completeTimeData()
      },
      runOnInit: true,
      start: true
    })
  }
}