var _ = require('lodash')
var math = require('mathjs')
var moment = require('moment-timezone')
var traverse = require('traverse')

var PID = require('../helpers/PID')
var heat = require('./heat')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class rest extends heat {
  constructor(options) {
    super(options)

    this.activeStep = options.activeStep

    // Check if the step is complete. Rest steps are complete when they sit for the desired amount of time.
    this.checkComplete = () => {
      if (this.stepTimer >= this.activeStep.stepTime * 60) {
        this.completeStep()
      }
    }

    this.on('tick', () => {
      this.time.setStepTime(null)
      this.time.setRemainingTime(this.activeStep.stepTime * 60 - this.stepTimer)
    })
  }
}
