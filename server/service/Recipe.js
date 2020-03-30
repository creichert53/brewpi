const timeFormat = require('./hhmmss')
const { EventEmitter } = require('events')
const cron = require('cron').CronJob
const redis = require('redis')
const uuid = require('uuid').v4
const moment = require('moment-timezone')
const PID = require('./PID')
const Promise = require('bluebird')
const BreweryIO = require('./BreweryIO')
const { get, cloneDeep, first } = require('lodash')
const traverse = require('traverse')
const logger = require('./logger')

Promise.promisifyAll(redis.RedisClient.prototype)

/**
 *  * THE MAIN RECIPE CLASS
 */
class Recipe extends EventEmitter {
  /** ID of the recipe for mapping the temperature to a specific task. */
  #recipeId = ''
  /** The Recipe Object */
  #recipe = {}
  /** The total time for the recipe. */
  #totalTime = new Time(0)
  /** Object to read temp inputs and write outputs. */
  #io = new BreweryIO(uuid())
  /** PID Loop to be used by any given step */
  #PID = new PID()
  /** The Redis client for the localhost */
  #redis = redis.createClient()
  /** Update temperature in the Redis table */
  #updateTemps = new cron({
    cronTime: '*/2 * * * * *',
    onTick: async () => {
      const temps = await this.#io.readTemps()
      temps.id = uuid() // create a unique identifier
      temps.stepId = this.#currentStep.id // for tracking purposes keep the step id with the temp datapoint
      temps.recipeId = this.#recipeId // for tracking purposes keep the recipe id with the temp datapoint
      temps.unix = moment().tz('America/New_York').unix() // add unix timestamp
      temps.timestamp = moment().tz('America/New_York').format() // add a utc timestamp with time zone
      await this.#redis.rpushAsync(['temp_array', JSON.stringify(temps)]) // append the temps object
      const llen = await this.#redis.llenAsync('temp_array') // array length
      if (llen > 7200) // 2 hrs in seconds
        await this.#redis.ltrimAsync('temp_array', 1, llen)
    },
    start: false,
    timeZone: 'America/New_York'
  })
  /** A timer that updates the recipe total time every second. */
  #timer = new cron({
    cronTime: '*/1 * * * * *',
    onTick: async () => {
      this.#totalTime.increment()
    },
    start: this.value.startBrew || false,
    timeZone: 'America/New_York'
  })
  #steps = []
  #currentStep = new Step({ id: 'default' })

  /**
   * @param  {object} recipe 
   */
  constructor(recipe, initialTimes) {
    super()
    this.value = recipe || false
    this.recipeId = get(recipe, 'id', null)

    this.io.on('output update', update => this.emit('output update', update))

    if (this.value) {
      if (this.value.startBrew) {
        this.#timer.start()
        this.#updateTemps.start()
      } else {
        // Reset the temp array on a new recipe that hasn't been started yet
        this.resetTemps()
      }
      this.#steps = cloneDeep(recipe.steps).filter(step => !step.complete)
    }

    const { totalTime, stepTime, remainingTime } = initialTimes || {}
    this.totalTime = totalTime || 0

    if (this.value.startBrew)
      this.nextStep(stepTime, remainingTime)
  }

  set totalTime(s) { this.#totalTime = new Time(s) }
  get totalTime() { return this.#totalTime }

  /** SET: The current recipe step. */
  set currentStep(step) { this.#currentStep = step }
  /** GET: The current recipe step. */
  get currentStep() { return this.#currentStep }

  /** SET: The current recipe. */
  set value(recipe) { this.#recipe = recipe }
  /** GET: The current recipe. */
  get value() { return this.#recipe }

  /** SET: The current recipe ID. */   
  set recipeId(id) { this.#recipeId = id }
  /** GET: The current recipe ID. */
  get recipeId() { return this.#recipeId }

  get io() { return this.#io }
  get PID() { return this.#PID }

  /** Reset totalTime back to 0 seconds */
  resetTotalTime() { this.totalTime = 0 }
  resetTemps() { this.#redis.del('temp_array') }
  start() {
    this.value = { ...cloneDeep(this.value), startBrew: true }
    this.nextStep()
    this.#timer.start()
  }
  nextStep(stepTime, remainingTime) {
    const nextIncompleteStep = first(this.value.steps.filter(step => !step.complete))

    if (nextIncompleteStep) {
      /** 
       * If any steps are left to execute, move on to the next one.
       * Else end the recipe.
       * */
      var newStep = new Step(nextIncompleteStep, this.value.id)
      switch(nextIncompleteStep.type) {
        case 'PREPARE_STRIKE_WATER':
        case 'PREPARE_FOR_HTL_HEAT':
        case 'PREPARE_FOR_MASH_RECIRC':
        case 'PREPARE_FOR_BOIL':
        case 'PREPARE_FOR_WORT_CHILL':
          logger.trace(`Starting new NoAction step: ${nextIncompleteStep.title}`)
          newStep = new NoAction(nextIncompleteStep, this.value.id, this.io); break
        case 'HEATING':
          logger.trace(`Starting new Heat step: ${nextIncompleteStep.title}`)
          newStep = new Heat(nextIncompleteStep, this.value.id, this.io, this.PID); break
        case 'CHILLING':
          logger.trace(`Starting new Chill step: ${newStep.title}`)
          newStep = new Chill(nextIncompleteStep, this.value.id, this.io); break
        case 'RESTING':
          // rest
          newStep = new Step(nextIncompleteStep, this.value.id); break
        case 'ADD_INGREDIENTS':
        case 'ADD_WATER_TO_MASH_TUN':
        case 'SPARGE':
          // rest and confirm
          newStep = new Step(nextIncompleteStep, this.value.id); break
        case 'BOIL':
          // boil
          newStep = new Step(nextIncompleteStep, this.value.id); break
      }

      // stop the current step before resetting the current step to the newly formed step
      this.currentStep.stop()

      // reset the current step
      this.currentStep = newStep
      this.currentStep.stepTime = stepTime || 0
      this.currentStep.remainingTime = remainingTime || 0
      this.currentStep.start()

      // The current step notifies the recipe that it has completed itself
      this.currentStep.on('end', () => {
        this.nextStep()
      })
    } else {
      this.end()
      this.emit('end') // Notify the server/frontend that everything is completed
    }

    return nextIncompleteStep
  }

  /** This function brute force quits the recipe at any point. */
  async quit() {
    // TODO Clean up database
    await this.io.unexportAll()
    this.currentStep.stop()
    this.PID.stopLoop()
    this.#updateTemps.stop()
    this.#timer.stop()
    await this.#redis.quitAsync()
  }

  /** This function is intendended to cleanly end the recipe. It will save the recipe as a completed brew session into the database. */
  async end() {
    // TODO Add database save for recipe
    await this.io.unexportAll()
    this.currentStep.stop()
    this.PID.stopLoop()
    this.#updateTemps.stop()
    this.#timer.stop()
    await this.#redis.quitAsync()
  }
}

/**
 *  * STEP PARENT CLASS 
 */
class Step extends EventEmitter {
  /** Track the id in the step object */
  #id = ''
  /** Details about the current step. */
  #step = {}
  /** IO for the step. */
  #io = null
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
    },
    start: false,
    timeZone: 'America/New_York'
  })
  /** PID Loop to be used by any given step */
  #PID = null

  constructor(step, recipeId, breweryIO, PID) {
    super()
    this.recipeId = recipeId
    this.step = step
    this.id = step.id
    this.io = breweryIO
    this.PID = PID

    this.resetTime()
  }

  /** Reset step and remaining times back to defaults */
  resetTime() {
    this.stepTime = 0

    // Set the remaining time to the step time (step time is in minutes so convert to seconds)
    if (this.#step.stepTime)
      this.remainingTime = this.#step.stepTime * 60
    else
      this.remainingTime = 0
  }

  set stepTime(time) { this.#stepTime = new Time(time) }
  get stepTime() { return this.#stepTime }

  set remainingTime(time) { this.#remainingTime = new Time(time) }
  get remainingTime() { return this.#remainingTime }

  get timer() { return this.#timer }

  set io(io) { this.#io = io }
  get io() { return this.#io }

  set id(id) { this.#id = id }
  get id() { return this.#id }

  set PID(PID) { this.#PID = PID }
  get PID() { return this.#PID }
  
  set step(step) { this.#step = step }
  get step() { return this.#step }

  pause() { this.#timer.stop() }
  start() {
    logger.trace('STARTING STEP...')
    this.#timer.start()
  }
  stop() { this.#timer.stop() }
  complete() {
    logger.info('Step Completed')
    this.#timer.stop()
    this.emit('end')
  }
}

// .##....##..#######........###.....######..########.####..#######..##....##
// .###...##.##.....##......##.##...##....##....##.....##..##.....##.###...##
// .####..##.##.....##.....##...##..##..........##.....##..##.....##.####..##
// .##.##.##.##.....##....##.....##.##..........##.....##..##.....##.##.##.##
// .##..####.##.....##....#########.##..........##.....##..##.....##.##..####
// .##...###.##.....##....##.....##.##....##....##.....##..##.....##.##...###
// .##....##..#######.....##.....##..######.....##....####..#######..##....##
/** NO ACTION STEP */
class NoAction extends Step {
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)
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

// .##.....##.########....###....########.####.##....##..######..
// .##.....##.##.........##.##......##.....##..###...##.##....##.
// .##.....##.##........##...##.....##.....##..####..##.##.......
// .#########.######...##.....##....##.....##..##.##.##.##...####
// .##.....##.##.......#########....##.....##..##..####.##....##.
// .##.....##.##.......##.....##....##.....##..##...###.##....##.
// .##.....##.########.##.....##....##....####.##....##..######..
/** HEATING STEP */
class Heat extends Step {
  constructor(step, recipeId, breweryIO, PID) {
    super(step, recipeId, breweryIO, PID)

    // Listen to the PID output and set the heater output.
    this.PID.on('output', async output => {
      // Get the RIMS temperature
      const { temp2 } = await breweryIO.readTemps()

      this.PID.setInput(temp2)
      var out = output / 100.0

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

  /** Start the Heat step.
   *  1. Start the recirc pump.
   *  2. Close the contactor to enable heating.
   *  3. Start the PID heating loop.
  */
  start() {
    this.parent.start.call(this)
    this.io.Pump1.on()
    setTimeout(() => {
      this.io.Contactor1.on()
      this.PID.startLoop()
    }, 3000)
  }

  /** Stop the Heat step.
   *  1. Stop the PID heating loop.
   *  2. Turn the heater off.
   *  3. Turn the contactor off to mechanically prevent heating.
  */
  stop() {
    this.parent.stop.call(this)
    this.PID.stopLoop()
    this.io.Heat1.off()
    this.io.Contactor1.off()
    setTimeout(() => {
      this.io.Pump1.off()
    }, 3000)
  }
}
Heat.prototype.parent = Step.prototype

// ..######..##.....##.####.##.......##.......####.##....##..######..
// .##....##.##.....##..##..##.......##........##..###...##.##....##.
// .##.......##.....##..##..##.......##........##..####..##.##.......
// .##.......#########..##..##.......##........##..##.##.##.##...####
// .##.......##.....##..##..##.......##........##..##..####.##....##.
// .##....##.##.....##..##..##.......##........##..##...###.##....##.
// ..######..##.....##.####.########.########.####.##....##..######..

/** CHILLING STEP */
class Chill extends Step {
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)
  }

  /** Start the Chill step. During this step, the pump just continues to run. */
  start() {
    this.parent.start.call(this)
    this.io.Pump1.on()
  }

  /** Stop the Heat step. Shut the pump off. */
  stop() {
    this.parent.stop.call(this)
    this.io.Pump1.off()
  }
}
Chill.prototype.parent = Step.prototype

// .##.....##.########.####.##.......####.########.##....##.....######..##..........###.....######...######..########..######.
// .##.....##....##.....##..##........##.....##.....##..##.....##....##.##.........##.##...##....##.##....##.##.......##....##
// .##.....##....##.....##..##........##.....##......####......##.......##........##...##..##.......##.......##.......##......
// .##.....##....##.....##..##........##.....##.......##.......##.......##.......##.....##..######...######..######....######.
// .##.....##....##.....##..##........##.....##.......##.......##.......##.......#########.......##.......##.##.............##
// .##.....##....##.....##..##........##.....##.......##.......##....##.##.......##.....##.##....##.##....##.##.......##....##
// ..#######.....##....####.########.####....##.......##........######..########.##.....##..######...######..########..######.

/** TIME OBJECT */
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

module.exports = Recipe