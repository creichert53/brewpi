var step = require('./__step')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class noAction extends step {
  constructor(options) {
    super(options)

    this.time = options.time

    options.gpio.heat1.writeSync(0)
    options.gpio.contactor1.writeSync(0)
    setTimeout(() => {
      options.gpio.pump1.writeSync(0)
    }, 5000)

    this.io = options.io

    this.on('tick', () => {
      this.time.setStepTime(this.stepTimer)
      this.time.setRemainingTime(null)
    })
  }
}
