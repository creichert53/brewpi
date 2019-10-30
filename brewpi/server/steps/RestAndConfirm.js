var _ = require('lodash')
var math = require('mathjs')
var moment = require('moment-timezone')
var traverse = require('traverse')

var PID = require('../helpers/PID')
var heat = require('./Heat')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class RestAndConfirm extends heat {
  constructor(options) {
    super(options)

    this.activeStep = options.activeStep

    // Check if the step is complete. Rest steps are complete when they sit for the desired amount of time.
    this.checkComplete = () => { /** THIS IS A DIRECT OVERRIDE OF THE HEAT STEP. ENDS WHEN NEXT BUTTON IS CLICKED **/ }

    this.on('tick', () => {
      this.time.setStepTime(this.stepTimer)
      this.time.setRemainingTime(null)
    })
  }
}
