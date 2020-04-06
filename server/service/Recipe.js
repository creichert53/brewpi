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
const {
  completeNodeInRecipe,
  updateStoreOnChange,
} = require('./utility')

Promise.promisifyAll(redis.RedisClient.prototype)

/**
 *  * THE MAIN RECIPE CLASS
 */
class Recipe extends EventEmitter {
  /**
   * @param  {object} recipe The recipe json object
   * @param  {object} initialTimes The initial totalTime, stepTime, and remainingTime
   */
  constructor(recipe, initialTimes) {
    super()

    // Global clear for any currently operating timeouts
    clearAllTimeouts()

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
    }

    const { totalTime, stepTime, remainingTime } = initialTimes || {}
    this.totalTime = totalTime || 0

    if (recipe && this.value.startBrew) {
      logger.trace('STARTING BREW')
      this.nextStep(stepTime, remainingTime)
    }
  }

  /** ID of the recipe for mapping the temperature to a specific task. */
  #recipeId = ''
  /** The Recipe Object */
  #recipe = {}
  /** The total time for the recipe. */
  #totalTime = new Time(0)
  /** Object to read temp inputs and write outputs. */
  #io = new BreweryIO()
  /** PID Loop to be used by any given step */
  #PID = new PID()
  /** The Redis client for the localhost */
  #redis = redis.createClient()
  /** The current recipe step. */
  #currentStep = new Step({ id: 'default' })
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
      if (llen > 21600) // 12 hrs in seconds at 2 second intervals
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

      // Tell the recipe to notify the frontend.
      this.emit('time', {
        totalTime: this.#totalTime,
        stepTime: this.#currentStep.stepTime,
        remainingTime: this.#currentStep.remainingTime
      })
    },
    start: this.value.startBrew || false,
    timeZone: 'America/New_York'
  })

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

  /** Reset all time values back to initial state of 0s. */
  resetTimes() {
    this.totalTime = 0
    if (this.currentStep) {
      this.currentStep.resetTime()
    }
    this.emit('time', {
      totalTime: this.#totalTime,
      stepTime: this.#currentStep.stepTime || new Time(0),
      remainingTime: this.#currentStep.remainingTime || new Time(0)
    })
  }
  resetTemps() {
    // TODO Enable this when done testing charts.
    // this.#redis.del('temp_array')
  }
  async nextStep(stepTime, remainingTime) {
    /** 1. Complete the node in the recipe
     *  2. Get the store so it can be updated with the new recipe value
     *  3. Get the updated steps from the newly updated store
     *  4. Get the next incomplete step from the recipe
     */
    this.value = completeNodeInRecipe(this.value, this.currentStep.id)
    const store = JSON.parse(await this.#redis.getAsync('store'))
    await updateStoreOnChange({ ...cloneDeep(store), recipe: this.value })
    const { recipe: { steps } } = JSON.parse(await this.#redis.getAsync('store'))
    const nextIncompleteStep = first(steps.filter(step => !step.complete))

    if (nextIncompleteStep) {
      /** 
       * If any steps are left to execute, move on to the next one.
       * Else end the recipe.
       * */
      var newStep = null
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

      // wait for the current step to stop before resetting the current step to the newly formed step
      // In the stop function, there may be asynchronous timeouts as devices 'unload' hence the wait
      await this.currentStep.stop()

      // reset the current step
      this.currentStep = newStep
      this.currentStep.stepTime = stepTime || 0
      this.currentStep.remainingTime = remainingTime || 0

      // wait for startup procedures before continuing
      this.currentStep.start()

      // The current step notifies the recipe that it has completed itself
      this.currentStep.on('end', () => {
        logger.trace('Received end event from current step. Moving to next step.')
        this.nextStep()
      })
    } else {
      this.end()
      this.emit('end') // Notify the server/frontend that everything is completed
    }

    return nextIncompleteStep
  }

  start() {
    this.value = { ...cloneDeep(this.value), startBrew: true }
    this.nextStep()
    this.#timer.start()
  }

  /** This function brute force quits the recipe at any point. */
  async quit() {
    // TODO Clean up database
    this.currentStep.stop()
    this.PID.stopLoop()
    this.#updateTemps.stop()
    this.#timer.stop()
    await this.#redis.quitAsync()
    await this.io.unexportAll()
  }

  /** This function is intendended to cleanly end the recipe. It will save the recipe as a completed brew session into the database. */
  async end() {
    // TODO Add database save for recipe
    this.currentStep.stop()
    this.PID.stopLoop()
    this.#updateTemps.stop()
    this.#timer.stop()
    await this.#redis.quitAsync()
    await this.io.unexportAll()
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
  /** A timer that updates current step time, stores it in memory, and tells the recipe to forward to the frontend. */
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
  #PID = new PID() // variable exposing methods


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

  /** The step setpoint. Only needed for heating and rest steps but exposed here to for inherited classes. */
  #setpoint = 0

  /** The setpoint for a step is the provided setpoint value plus any setpoint adjustment  */
  set setpoint(sp) { this.#setpoint = sp }
  get setpoint() { return this.#setpoint }

  pause() { this.#timer.stop() }
  complete() {
    logger.info('Step Completed')
    this.#timer.stop()
    this.emit('end')
  }
  async start() {
    logger.trace(`STARTING STEP: ${this.#id}`)
    this.#timer.start()
  }
  async stop() {
    this.#timer.stop()
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
  }

  #startTimeout = null

  async start() {
    await this.parent.start.call(this)
    this.io.Heat1.autoOff()
    this.io.Heat2.autoOff()
    this.io.Contactor1.autoOff()
    this.io.Contactor2.autoOff()
    this.#startTimeout = setTimeoutGlobal(() => {
      this.io.Pump1.autoOff()
      this.io.Pump2.autoOff()
    }, 5000)
  }

  async stop() {
    return new Promise(async (resolve) => {
      await this.parent.stop.call(this)
      if (this.#startTimeout)
        clearTimeoutGlobal(this.#startTimeout)
      resolve()
    })
  }
}
NoAction.prototype.parent = Step.prototype

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
      this.#stepTemp = temp2

      // Get the settings from the redis store
      const client = redis.createClient()
      const store = await client.getAsync('store')
      client.quit()
      const {
        settings: {
          rims: {
            proportional: kp,
            integral: ki,
            derivative: kd,
            maxOutput: max,
            setpointAdjust: adj
          }
        }
      } = JSON.parse(store)

      // Set the step setpoint on every iteration
      this.setpoint = step.setpoint + (adj || 0)

      this.PID.setInput(this.#stepTemp)
      this.PID.setTarget(this.setpoint)
      this.PID.setTuning(kp, ki, kd)
      this.PID.setOutputLimits(this.PID.outMin, max)
      var out = output / 100.0
      
      // With each tick of the PID loop, check if the step should be completed
      await this.checkComplete()

      // Read the status of the pump output and then decide how to handle the heater output
      try {
        var value = this.io.Pump1.currentValue()

        // If pump is on, allow PID loop to control heater
        // Else turn heater off
        if (value) {
          this.io.Heat1.autoOn() // turn heater ON
          setTimeoutGlobal(() => { // after output delay, turn heater OFF
            this.io.Heat1.autoOff()
          }, Math.max(0, out * this.PID.getTimeInterval() - 10)) // Output * Ratio of Interval - 10 ms (prevent interval overlap)
        } else {
          this.io.Heat1.autoOff() // should always be off if pump is off
        }
      } catch (err) {}
    })
  }

  #stopDelay = false
  #stepTemp = 0

  async checkComplete() {
    // If reached setpoint, set the flag to true and wait an additional 1 minutes to finish step
    if (this.#stepTemp >= this.setpoint && !this.#stopDelay) {
      this.#stopDelay = true
      logger.trace('Ending step initiated. Will end Heating step in 1 minute.')
      setTimeoutGlobal(async () => {
        await this.stop() // pump down
        this.emit('end') // when pump down is funished, tell the recipe we've ended
      }, 54000)
    }
  }

  /** Start the Heat step.
   *  1. Start the recirc pump.
   *  2. Close the contactor to enable heating.
   *  3. Start the PID heating loop.
  */
  async start() {
    await this.parent.start.call(this)
    setTimeoutGlobal(() => this.io.Pump1.autoOn(), 5000)
    setTimeoutGlobal(() => {
      this.io.Contactor1.autoOn()
      logger.trace('Starting Heating PID Loop')
      this.PID.startLoop()
    }, 8000)
  }

  /** Stop the Heat step.
   *  1. Stop the PID heating loop.
   *  2. Turn the heater off.
   *  3. Turn the contactor off to mechanically prevent heating.
  */
  async stop() {
    return new Promise((resolve) => {
      this.parent.stop.call(this)
      this.PID.stopLoop()
      this.io.Heat1.autoOff()
      this.io.Contactor1.autoOff()
      setTimeoutGlobal(() => {
        this.io.Pump1.autoOff()
        resolve()
      }, 4000)
    })
  }
}
Heat.prototype.parent = Step.prototype

/** REST STEP */
class Rest extends Heat {
  constructor(step, recipeId, breweryIO, PID) {
    super(step, recipeId, breweryIO, PID)
  }
}
Rest.prototype.parent = Heat.prototype

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
    this.io.Pump1.autoOn()
  }

  /** Stop the Heat step. Shut the pump off. */
  stop() {
    this.parent.stop.call(this)
    this.io.Pump1.autoOff()
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