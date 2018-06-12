var CronJob = require('cron').CronJob

/**
 * [exports description]
 * @type {[type]}
 */

module.exports = class _0_prepareStrikeWater {
  constructor(io, step) {
    this.io = io
    this.step = step
    this.paused = false
    this.isRunning = false

    this.stepTimer = 0
    this.stepTimerJob = null

    // Create a default CronJob that will run every second and update the store any time there is a change in the active step
    this.stepTimerJob = new CronJob({
      cronTime: '*/1 * * * * *',
      onTick: () => {
        this.stepTimer = this.stepTimer + 1
      },
      start: true,
      timeZone: 'America/New_York',
      runOnInit: true
    })
  }

  start() {
    this.paused = false,
    this.isRunning = true
  }

  finish() {
    this.paused = false
    this.isRunning = false
  }

  pause() {
    this.paused = true
    this.stepTimer.stop()
  }

  resume() {
    this.paused = false
  }
}
