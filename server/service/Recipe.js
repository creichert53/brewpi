const timeFormat = require('./hhmmss')
const { EventEmitter } = require('events')
const cron = require('cron').CronJob
const redis = require('redis')
const uuid = require('uuid').v4
const moment = require('moment-timezone')
const PID = require('./PID')
const Promise = require('bluebird')
const BreweryIO = require('./BreweryIO')

Promise.promisifyAll(redis.RedisClient.prototype)

class Time {
  #value = 0
  #shouldBeNumericError = Error('Time must be a numeric value.')
  /**
   * @param  {number} time Time in seconds
   */
  constructor(time = 0) { // time in seconds
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
  decrement() {
    this.#value = this.#value - 1
    return this.#value
  }
}

class Recipe {
  /** ID of the recipe for mapping the temperature to a specific task. */
  #recipeId = ''
  /** The Redis client for the localhost */
  #redis = redis.createClient()
  /** Object to read temp inputs and write outputs. */
  #io = new BreweryIO()
  /** PID Loop to be used by any given step */
  #PID = new PID()
  /** Update temperature in the Redis table */
  #updateTemps = async () => {
    const temps = await this.#io.readTemps()
    temps.id = uuid() // create a unique identifier
    temps.stepId = this.#step.id // for tracking purposes keep the step id with the temp datapoint
    temps.recipeId = this.#recipeId // for tracking purposes keep the recipe id with the temp datapoint
    temps.unix = moment().tz('America/New_York').unix() // add unix timestamp
    temps.timestamp = moment().tz('America/New_York').format() // add a utc timestamp with time zone
    await this.#redis.rpushAsync(['temps', JSON.stringify(temps)]) // append the temps object
    const llen = await this.#redis.llenAsync('temps') // array length
    if (llen > 7200) // 2 hrs in seconds
      await this.#redis.ltrimAsync('temps', 1, llen)
  }
  /** The total time for the recipe. */
  #totalTime = new Time(0)
  #recipe = {}
  #currentStep = null
  #nextStep = (steps) => {
    this.#currentStep = steps.shift()
    this.#currentStep.start()
    this.#currentStep.on('end', () => {
      if (steps.length > 0)
        this.#nextStep(steps)
    })
  }

  /**
   * @param  {object} recipe 
   */
  constructor(recipe) {
    this.value = recipe || false

    if (this.value) {
      var steps = recipe.steps.map(step => {
        // new Step(recipe.id, step)
        switch(step.type) {
          case 'PREPARE_STRIKE_WATER':
          case 'PREPARE_FOR_HTL_HEAT':
          case 'PREPARE_FOR_MASH_RECIRC':
          case 'PREPARE_FOR_BOIL':
          case 'PREPARE_FOR_WORT_CHILL':
            return new NoAction(breweryIO, recipe.id, step, this.PID)
          case 'HEATING':
            return new Heat(breweryIO, recipe.id, step, this.PID)
          case 'CHILLING':
            // chill
            break
          case 'RESTING':
            // rest
            break
          case 'ADD_INGREDIENTS':
          case 'ADD_WATER_TO_MASH_TUN':
          case 'SPARGE':
            // rest and confirm
            break
          case 'BOIL':
            // boil
            break
        }
      })
      this.#nextStep(steps)
    }
  }

  /** Reset all times back to 0 seconds */
  resetTime() {
    this.totalTime = 0
  }

  get totalTime() { return this.#totalTime }
  get currentStep() { return this.#currentStep }
  get value() { return this.#recipe }
  set value(recipe) { this.#recipe = recipe }

  get PID() { return this.#PID }
  set recipeId(id) { this.#recipeId = id }

  resetTemps() { this.#redis.del('temps') }
}

class Step extends EventEmitter {
  /** Details about the current step. */
  #step = {}
  /** Time object to track how long the current step takes. */
  #stepTime = new Time(0)
  /** The time remaining in the current step. */
  #remainingTime = new Time(0)
  /** Update the step remaining time. Will only decrement the time if a truthy value is supplied. */
  #updateRemainingTime = (doUpdate) => {
    // Decrease the step timer by 1 second
    if (doUpdate) this.#remainingTime.decrement()
  }
  /** Increment the step time. */
  #updateStepTime = () => this.#stepTime.increment()
  /** A time that updates necessary data on the current step every second. */
  #timer = new cron({
    cronTime: '*/1 * * * * *',
    onTick: async () => {
      this.#updateRemainingTime(this.#step.stepTime)
      this.#updateStepTime()
      this.#updateTemps()
    },
    start: false,
    timeZone: 'America/New_York'
  })
  /** PID Loop to be used by any given step */
  #PID = null

  constructor(breweryIO, recipeId, step, PID) {
    super()
    this.recipeId = recipeId
    this.step = step
    this.io = breweryIO
    this.PID = PID
    this.resetTemps()

    // Set the remaining time to the step time (step time is in minutes so convert to seconds)
    if (step.stepTime)
      this.remainingTime = step.stepTime * 60
  }

  get stepTime() { return this.#stepTime }
  get remainingTime() { return this.#remainingTime }
  set stepTime(time) { this.#stepTime = new Time(time) }
  set remainingTime(time) { this.#remainingTime = new Time(time) }

  set io(io) { this.#io = io }
  get io() { return this.#io }

  set PID(PID) { this.#PID = PID }
  set step(step) { this.#step = step }

  pause() { this.#timer.stop() }
  start() { this.#timer.start() }
}

class NoAction extends Step {
  constructor(breweryIO, recipeId, step) {
    super(breweryIO, recipeId, step)
    this.io.Heat1.off()
    this.io.Heat2.off()
    this.io.Contactor1.off()
    this.io.Contactor2.off()
    setTimeout(() => {
      this.io.Pump1.off()
      this.io.Pump2.off()
    }, 5000)
  }
}

class Heat extends Step {
  constructor(breweryIO, recipeId, step, PID) {
    super(breweryIO, recipeId, step, PID)

    // Listen to the PID output and set the heater output.
    this.PID.startLoop()
    this.PID.on('output', output => {
      this.PID.setInput(/** TODO Need to add the temp value for the RIMS tube here */) // TODO
      var out = output / 100

      // Read the status of the pump output and then decide how to handle the heater output
      const value = this.io.Pump1.currentValue()

      // If pump is on, allow PID loop to control heater
      // Else turn heater off
      if (value) {
        this.io.Heat1.on() // turn heater ON
        setTimeout(() => { // after output delay, turn heater OFF
          this.io.Heat1.off()
        }, Math.max(0, out * this.PID.getTimeInterval() - 10)) // Output * Ratio of Interval - 10 ms (prevent interval overlap)
      } else {
        this.io.Heat1.off() // should always be off if pump is off
      }
    })
  }
}

module.exports = Recipe