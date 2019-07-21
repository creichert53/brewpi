var step = require('./__step')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class noAction extends step {
  constructor(options) {
    super(options)

    this.time = options.time

    options.gpio.heat1.writeSync(options.gpio.overrides.heat1 ? (options.gpio.overrides.heat1.value === -1 ? 0 : 1) : 0)
    options.gpio.auto.heat1 = 0
    options.gpio.heat2.writeSync(options.gpio.overrides.heat2 ? (options.gpio.overrides.heat2.value === -1 ? 0 : 1) : 0)
    options.gpio.auto.heat2 = 0
    options.gpio.contactor1.writeSync(options.gpio.overrides.contactor1 ? (options.gpio.overrides.contactor1.value === -1 ? 0 : 1) : 0)
    options.gpio.auto.contactor1 = 0
    options.gpio.contactor2.writeSync(options.gpio.overrides.contactor2 ? (options.gpio.overrides.contactor2.value === -1 ? 0 : 1) : 0)
    options.gpio.auto.contactor2 = 0
    setTimeout(() => {
      options.gpio.pump1.writeSync(options.gpio.overrides.pump1 ? (options.gpio.overrides.pump1.value === -1 ? 0 : 1) : 0)
      options.gpio.auto.pump1 = 0
      options.gpio.pump2.writeSync(options.gpio.overrides.pump2 ? (options.gpio.overrides.pump2.value === -1 ? 0 : 1) : 0)
      options.gpio.auto.pump2 = 0
    }, 5000)

    this.io = options.io

    this.on('tick', () => {
      this.time.setStepTime(this.stepTimer)
      this.time.setRemainingTime(null)
    })
  }
}
