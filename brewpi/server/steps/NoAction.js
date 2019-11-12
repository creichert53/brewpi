var step = require('./__step')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class NoAction extends step {
  constructor(options) {
    super(options)

    this.time = options.time

    gpio.writeOutput('heat1', 0)
    gpio.writeOutput('heat2', 0)
    gpio.writeOutput('contactor1', 0)
    gpio.writeOutput('contactor2', 0)
    setTimeout(() => {
      gpio.writeOutput('pump1', 0)
      gpio.writeOutput('pump2', 0)
    }, 5000)

    this.io = options.io

    this.on('tick', () => {
      this.time.setRemainingTime(null)
    })
  }
}
