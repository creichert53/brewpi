const _ = require('lodash')
const timeFormat = require('../../src/helpers/hhmmss.js')
const moment = require('moment-timezone')

var EventEmitter = require('events').EventEmitter
var CronJob = require('cron').CronJob

/**
 * Options:
 *   io: the socket.io instance                             [required]
 *   step: the current step                                 [required]
 *   emitTime: if true, emit time on socket.io instance     [optional, default false]
 */

module.exports = class __step extends EventEmitter {
  constructor(options) {
    super()

    console.log(options.activeStep.title)

    // State variables
    this.io = options.io
    this.time = options.time
    this.activeStep = options.activeStep
    this.store = options.store
    this.temperatures = options.temperatures
    this.step = options.step
    this.paused = false
    this.isRunning = false

    // Timer variables
    const times = this.time.getValue()
    this.stepTimer = _.get(this.time.getValue(), 'stepTime', false)
      ? timeFormat.toS(this.time.getValue().stepTime, 'hh:mm:ss')
      : 0
    this.stepTimerJob = null

    var that = this

    // Create a default CronJob that will run every second and update the store any time there is a change in the active step
    this.stepTimerJob = new CronJob({
      cronTime: '*/1 * * * * *',
      onTick: () => {
        that.stepTimer = this.stepTimer + 1

        // emit each tick to any subclass
        that.emit('tick')
      },
      start: true,
      timeZone: 'America/New_York',
      runOnInit: true
    })

    this.tempTimerJob = new CronJob({
      cronTime: '*/2 * * * * *',
      onTick: () => {
        const times = this.time.getValue()
        this.temperatures.addTemp({
          stepId: this.activeStep.id,
          totalTime: _.get(times, 'totalTime', false) ? timeFormat.toS(this.time.getValue().totalTime, 'hh:mm:ss') : null,
          stepTime: _.get(times, 'stepTime', false) ? timeFormat.toS(this.time.getValue().stepTime, 'hh:mm:ss') : null,
          remainingTime: _.get(times, 'remainingTime', false) ? timeFormat.toS(this.time.getValue().remainingTime, 'hh:mm:ss') : null,
        })
      },
      start: true,
      timeZone: 'America/New_York',
      runOnInit: true
    })
  }

  start() {
    this.paused = false,
    this.isRunning = true
    this.stepTimerJob.start()
    this.tempTimerJob.start()
    this.emit('start')
  }

  stop() {
    this.paused = false
    this.isRunning = false
    this.stepTimerJob.stop()
    this.tempTimerJob.stop()
    this.emit('stop')
  }

  pause() {
    this.paused = true
    this.stepTimerJob.stop()
    this.tempTimerJob.stop()
    this.emit('pause')
  }

  resume() {
    this.paused = false
    this.stepTimerJob.start()
    this.tempTimerJob.start()
    this.emit('resume')
  }


}
