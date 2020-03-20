const ProgressPromise = require('progress-promise')
const timeFormat = require('../hhmmss')
const BreweryIO = require('../BreweryIO')
const { EventEmitter } = require('events')
const cron = require('cron').CronJob
const {
  get
} = require('lodash')

class Recipe {
  #totalTime = new Time(0)
  #recipe = {}
  /**
   * @param  {object} recipe The recipe object imported from Beersmith.
   */
  constructor(recipe) {
    this.resetTime()
    this.value = recipe || {}
    this.step = new Step({ id: 'hello' }, false, false)
  }

  /** Reset all times back to 0 seconds */
  resetTime() {
    this.totalTime = 0
  }
  get totalTime() {
    return this.#totalTime
  }
  set totalTime(time) {
    this.#totalTime = new Time(time)
  }

  get value() {
    return this.#recipe
  }
  set value(recipe) {
    this.#recipe = recipe
  }
}

class Time {
  #value = 0
  #shouldBeNumericError = Error('Time must be a numeric value.')
  /**
   * @param  {number} time Time in seconds
   */
  constructor(time) { // time in seconds
    if (typeof time === 'number') this.#value = time
    else throw this.#shouldBeNumericError
  }
  value() {
    return this.#value
  }
  toString() {
    return timeFormat.fromS(this.#value, 'hh:mm:ss')
  }
  increment() {
    this.#value = this.#value + 1
    return this.#value
  }
}

class Step extends EventEmitter {
  #step = {}
  #stepTime = new Time(0)
  #remainingTime = new Time(0)
  #io = new BreweryIO()
  #timer = new cron({
    cronTime: '*/1 * * * * *',
    onTick: async () => {
      if (get(this.#step, 'objects[0]'))

      const temps = await this.#io.readTemps()
    },
    start: true,
    timeZone: 'America/New_York'
  })
  constructor(step, useStepTime, useRemainingTime) {
    super()
    this.step = step
    this.useStepTime = useStepTime
    this.useRemainingTime = useRemainingTime
  }

  get stepTime() { return this.#stepTime }
  get remainingTime() { return this.#remainingTime }
  set stepTime(time) { this.#stepTime = new Time(time) }
  set remainingTime(time) { this.#remainingTime = new Time(time) }

  set step(step) { this.#step = step }
}

module.exports = Recipe