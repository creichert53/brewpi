var step = require('./__step')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class Chill extends step {
  constructor(options) {
    super(options)

    // Declare that variable to use inside other methods
    var that = this

    this.time = options.time
    this.gpio = options.gpio
    this.io = options.io

    this.on('tick', () => {
      this.time.setRemainingTime(null)
    })

    this.on('start', () => {
      setTimeout(() => {
        that.gpio.pump2.writeSync(options.gpio.overrides.pump2 ? (options.gpio.overrides.pump2.value === -1 ? 0 : 1) : 1)
        that.gpio.auto.pump2 = 1
      }, 2000)
    })

    // On a signal to stop, turn heater components off. Dissipate heat from element and shut pump off.
    this.on('stop', () => {
      that.gpio.pump2.writeSync(options.gpio.overrides.pump2 ? (options.gpio.overrides.pump2.value === -1 ? 0 : 1) : 1)
      that.gpio.auto.pump2 = 0
    })

    // On a signal to pause, stop heating functions
    this.on('pause', () => {
      that.gpio.pump2.writeSync(options.gpio.overrides.pump2 ? (options.gpio.overrides.pump2.value === -1 ? 0 : 1) : 1)
      that.gpio.auto.pump2 = 0
    })

    // On a signal to resume, start the loop back up. Heating functions should resume from there.
    this.on('resume', () => {
      that.gpio.pump2.writeSync(options.gpio.overrides.pump2 ? (options.gpio.overrides.pump2.value === -1 ? 0 : 1) : 1)
      that.gpio.auto.pump2 = 1
    })
  }
}
