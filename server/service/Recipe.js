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
const accurateInterval = require('accurate-interval')
const logger = require('./logger')
const {
  completeNodeInRecipe,
  setRedisStore,
  setRedisTime,
  getRedisStore
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

    this.value = recipe || {}
    this.recipeId = get(recipe, 'id', null)
    this.#redis = redis.createClient()

    this.io.on('output update', update => this.emit('output update', update))

    // update the in memory store with the correct time and notify the connected frontend
    if (recipe) { // only do the following if a recipe is fed in
      const { totalTime = 0, stepTime = 0, remainingTime = 0 } = initialTimes || {}
      setRedisTime({
        totalTime: new Time(totalTime),
        stepTime: new Time(stepTime),
        remainingTime: new Time(remainingTime)
      })
      this.totalTime = totalTime || 0
  
      if (this.value.startBrew) {
        logger.trace('STARTING BREW')
        this.nextStep(stepTime, remainingTime)
      }
    }
  }
  
  async nextStep(stepTime, remainingTime) {
    // Pause the timers
    this.#timer.stop() // stop the timer so it doesn't overwrite the store
    this.#currentStep.timer.stop() // stop the current step timer so we can initialize a new step

    /** 1. Complete the node in the recipe
     *  2. Get the store so it can be updated with the new recipe value
     *  3. Get the updated steps from the newly updated store
     *  4. Get the next incomplete step from the recipe
     */
    this.value = completeNodeInRecipe(this.value, this.currentStep.id)
    const { recipe: { steps }} = await setRedisStore({ recipe: this.value })
    const nextIncompleteStep = first(steps.filter(step => !step.complete))

    // Keep the server up to date with all step changes
    this.emit('update recipe from server', this.value)

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
          logger.trace(`CREATING NoAction STEP: ${nextIncompleteStep.title}`)
          newStep = new NoAction(nextIncompleteStep, this.value.id, this.io); break
        case 'HEATING':
          logger.trace(`CREATING Heat STEP: ${nextIncompleteStep.title}`)
          newStep = new Heat(nextIncompleteStep, this.value.id, this.io); break
        case 'CHILLING':
          logger.trace(`CREATING Chill STEP: ${nextIncompleteStep.title}`)
          newStep = new Chill(nextIncompleteStep, this.value.id, this.io); break
        case 'RESTING':
          logger.trace(`CREATING Rest STEP: ${nextIncompleteStep.title}`)
          newStep = new Rest(nextIncompleteStep, this.value.id, this.io); break
        case 'ADD_INGREDIENTS':
        case 'ADD_WATER_TO_MASH_TUN':
        case 'SPARGE':
          logger.trace(`CREATING Rest and Confirm STEP: ${nextIncompleteStep.title}`)
          newStep = new RestAndConfirm(nextIncompleteStep, this.value.id, this.io); break
        case 'BOIL':
          // boil
          newStep = new Boil(nextIncompleteStep, this.value.id, this.io); break
      }

      // wait for the current step to stop before resetting the current step to the newly formed step
      // In the stop function, there may be asynchronous timeouts as devices 'unload' hence the wait
      await this.currentStep.stop()

      // If the next step is a prepare for step, then pump down. else, do not pump down
      if (this.currentStep.type === 'HEATING' && newStep.type.includes('PREPARE')) {
        await this.currentStep.pumpDown()
      }

      // reset the current step
      this.currentStep = newStep
      this.currentStep.stepTime = stepTime || 0
      this.currentStep.remainingTime = remainingTime
        ? remainingTime
        :  this.currentStep.step.stepTime
        ? this.currentStep.step.stepTime * 60
        : 0

      // wait for startup procedures before continuing
      this.currentStep.start()

      this.#timer.start() // start timer back up after store changed
      this.#updateTemps.start() // make sure the temps are being logged as well

      // The current step notifies the main server that the step is completed and it needs to relay that info to the frontend
      this.currentStep.on('end', ({ duration }) => {
        logger.trace('Received end event from current step. Moving to next step.')
        if (duration > 0) {
          setTimeoutGlobal(() => {
            this.nextStep()
          }, duration)
        } else {
          this.nextStep()
        }
      })

      // Send a snackbar message to the frontend
      this.currentStep.on('set snackbar message', args => {
        this.emit('set snackbar message', args)
      })
    } else {
      this.end()
    }

    return nextIncompleteStep
  }

  /** ID of the recipe for mapping the temperature to a specific task. */
  #recipeId = ''
  /** The Recipe Object */
  #recipe = {}
  /** The total time for the recipe. */
  #totalTime = new Time(0)
  /** Object to read temp inputs and write outputs. */
  #io = new BreweryIO()
  /** The Redis client for the localhost */
  #redis = null
  /** The current recipe step. */
  #currentStep = new Step({ id: 'default' })
  /** Update temperature in the Redis table */
  #updateTemps = new cron({
    cronTime: '*/1 * * * * *',
    onTick: async () => {
      try {
        const temps = await this.#io.readTemps()
        temps.id = uuid() // create a unique identifier
        temps.stepId = this.#currentStep.id // for tracking purposes keep the step id with the temp datapoint
        temps.recipeId = this.#recipeId // for tracking purposes keep the recipe id with the temp datapoint
        temps.unix = moment().tz('America/New_York').unix() // add unix timestamp
        temps.timestamp = moment().tz('America/New_York').format() // add a utc timestamp with time zone
        temps.complete = false
        await this.#redis.rpushAsync(['temp_array', JSON.stringify(temps)]) // append the temps object
        const llen = await this.#redis.llenAsync('temp_array') // array length
        if (llen > 43200) // 12 hrs in seconds at 1 second intervals
          await this.#redis.ltrimAsync('temp_array', 1, llen)
      } catch (error) {
        if (!error.message.includes('The connection is already closed.'))
          logger.error(error)
      }
    },
    start: false,
    timeZone: 'America/New_York'
  })
  /** A timer that updates the recipe total time every second. */
  #timer = new cron({
    cronTime: '*/1 * * * * *',
    onTick: async () => {
      this.#totalTime.increment()

      await setRedisTime({
        totalTime: this.#totalTime,
        stepTime: this.currentStep.stepTime,
        remainingTime: this.currentStep.remainingTime
      })

      // If moving to the next step, make sure the time is stopped until the step is switched
      if (this.currentStep.checkComplete()) {
        this.#timer.stop()
        await this.nextStep()
        this.#timer.start()
      }

      // Tell the recipe to notify the frontend.
      this.emit('time', {
        totalTime: this.#totalTime.toString(),
        stepTime: this.#currentStep.stepTime.toString(),
        remainingTime: this.#currentStep.remainingTime.toString()
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

  start() {
    this.value = { ...cloneDeep(this.value), startBrew: true }
    this.nextStep()
    this.#timer.start()
  }

  /** This function brute force quits the recipe at any point. */
  async quit() {
    this.currentStep.stop()
    this.#updateTemps.stop()
    this.#timer.stop()
    await this.#redis.quitAsync()
    await this.io.unexportAll()
  }

  /** This function is intendended to cleanly end the recipe. It will save the recipe as a completed brew session into the database. */
  async end() {
    // TODO Add database save for recipe so a report can be generated at any time.
    this.currentStep.stop()
    this.#updateTemps.stop()
    this.#timer.stop()
    await this.#redis.quitAsync()
    this.emit('end recipe') // Notify the server/frontend that everything is completed
  }
}

// ..######..########.########.########.
// .##....##....##....##.......##.....##
// .##..........##....##.......##.....##
// ..######.....##....######...########.
// .......##....##....##.......##.......
// .##....##....##....##.......##.......
// ..######.....##....########.##.......

/** STEP PARENT CLASS */
class Step extends EventEmitter {
  /** Track the id in the step object */
  #id = ''
  /** Details about the current step. */
  #step = {}
  /** The specific step type. */
  #type = ''
  /** IO for the step. */
  #io = null
  /** Time object to track how long the current step takes. */
  #stepTime = new Time(0)
  /** The time remaining in the current step. */
  #remainingTime = new Time(0)
  /** Update the step remaining time. Will only decrement the time if a truthy value is supplied. */
  #updateRemainingTime = (doUpdate) => {
    // Decrease the step timer by 1 second
    if (doUpdate)
      this.#remainingTime.decrement()
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

  constructor(step, recipeId, breweryIO) {
    super()
    this.recipeId = recipeId
    this.step = step
    this.id = step.id
    this.io = breweryIO

    if (step.stepTime) {
      this.remainingTime = step.stepTime * 60
    } else {
      this.remainingTime = 0
    }
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

  set type(type) { this.#type = type }
  get type() { return this.#type }

  set PID(PID) { this.#PID = PID }
  get PID() { return this.#PID }
  
  set step(step) { this.#step = step }
  get step() { return this.#step }

  /** The step setpoint. Only needed for heating and rest steps but exposed here to for inherited classes. */
  #setpoint = 0

  /** The setpoint for a step is the provided setpoint value plus any setpoint adjustment  */
  set setpoint(sp) { this.#setpoint = sp }
  get setpoint() { return this.#setpoint }

  async start() {
    logger.trace(`STARTING STEP: ${this.step.title}, ${this.#id}`)
    this.#timer.start()
  }
  async stop() {
    this.#timer.stop()
  }

  checkComplete() {
    /** PLACEHOLDER - only do something if overridden */
    return false
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
    this.parent.stop.call(this)
    if (this.#startTimeout)
      clearTimeoutGlobal(this.#startTimeout)
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
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)

    this.PID = new PID()

    // Listen to the PID output and set the heater output.
    this.PID.on('output', async output => {
      // Get the RIMS temperature
      const { temp2 } = await breweryIO.readTemps()
      this.#stepTemp = temp2

      // Get the settings from the redis store
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
      } = await getRedisStore()

      // Set the step setpoint on every iteration
      this.setpoint = step.setpoint + (adj || 0)

      this.PID.setInput(this.#stepTemp)
      this.PID.setTarget(this.setpoint)
      this.PID.setTuning(kp, ki, kd)
      this.PID.setOutputLimits(this.PID.outMin, max)
      var out = output / 100.0

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

  /** Start the Heat step.
   *  1. Start the recirc pump.
   *  2. Close the contactor to enable heating.
   *  3. Start the PID heating loop.
  */
  async start() {
    await this.parent.start.call(this)
    setTimeoutGlobal(() => this.io.Pump1.autoOn(), 5000)
    return new Promise((resolve) => {
      setTimeoutGlobal(() => {
        this.io.Contactor1.autoOn()
        logger.trace('Starting Heating PID Loop')
        this.PID.startLoop()
        resolve()
      }, 8000)
    })
  }

  /** Stop the Heat step.
   *  1. Stop the PID heating loop.
   *  IF NEED TO PUMP DOWN
   *  2. Turn the heater off.
   *  3. Turn the contactor off to mechanically prevent heating.
  */
  async stop() {
    this.parent.stop.call(this)
    this.PID.stopLoop()
  }

  /** Sequence equipment off if this function is called. */
  pumpDown() {
    return new Promise((resolve) => {
      logger.trace(`Pumping down ${this.step.title}`)
      this.io.Heat1.autoOff()
      this.io.Contactor1.autoOff()
      setTimeoutGlobal(() => {
        this.io.Pump1.autoOff()
        resolve()
      }, 4000)
    })
  }

  checkComplete() {
    // If reached setpoint, set the flag to true and wait an additional 1 minutes to finish step
    // This is so the PID loop has approximately 1 minute to temper the bulk load. If it ended as
    // soon as setpoint was reached, the resevoir the pump is pulling from would be at some temperature
    // less than the setpoint. This will help bring that resevoir to a more uniform temp closer to setpoint.
    if (this.#stepTemp > this.setpoint && !this.#stopDelay) {
      this.#stopDelay = true
      logger.trace('Ending step initiated. Will end Heating step in 1 minute.')
      this.emit('set snackbar message', { message: 'Ending heating step in 1 minute.' })
      this.emit('end', { duration: 10000 })
    }
    return false
  }
}
Heat.prototype.parent = Step.prototype

// .########..########..######..########
// .##.....##.##.......##....##....##...
// .##.....##.##.......##..........##...
// .########..######....######.....##...
// .##...##...##.............##....##...
// .##....##..##.......##....##....##...
// .##.....##.########..######.....##...

/** REST STEP */
class Rest extends Heat {
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)
  }

  async start() {
    this.parent.parent.start.call(this)
    this.io.Pump1.autoOn()
    this.io.Contactor1.autoOn()
    this.PID.startLoop()
  }

  checkComplete() {
    // Remaining time is updated every second
    if (this.stepTime.value() > 0 && this.remainingTime.value() <= 0) {
      return true
    } else {
      return false
    }
  }
}
Rest.prototype.parent = Heat.prototype
Rest.prototype.parent.parent = Step.prototype

// .########..########..######..########.......###....##....##.########......######...#######..##....##.########.####.########..##.....##
// .##.....##.##.......##....##....##.........##.##...###...##.##.....##....##....##.##.....##.###...##.##........##..##.....##.###...###
// .##.....##.##.......##..........##........##...##..####..##.##.....##....##.......##.....##.####..##.##........##..##.....##.####.####
// .########..######....######.....##.......##.....##.##.##.##.##.....##....##.......##.....##.##.##.##.######....##..########..##.###.##
// .##...##...##.............##....##.......#########.##..####.##.....##....##.......##.....##.##..####.##........##..##...##...##.....##
// .##....##..##.......##....##....##.......##.....##.##...###.##.....##....##....##.##.....##.##...###.##........##..##....##..##.....##
// .##.....##.########..######.....##.......##.....##.##....##.########......######...#######..##....##.##.......####.##.....##.##.....##

/** REST AND CONFIRM STEP */
class RestAndConfirm extends Heat {
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)
  }

  checkComplete() {
    // These steps are complete when todos are confirmed.
    // This is just an override for the heat checkComplete method so it doesn't continually check for temp completion.
    // We still want to control heating and pump outputs just like a normal heat step though. We will just let the
    // recipe decide to complete the step when all todos are complete.
    return false 
  }
}
Rest.prototype.parent = Heat.prototype
Rest.prototype.parent.parent = Step.prototype

// .########...#######..####.##......
// .##.....##.##.....##..##..##......
// .##.....##.##.....##..##..##......
// .########..##.....##..##..##......
// .##.....##.##.....##..##..##......
// .##.....##.##.....##..##..##......
// .########...#######..####.########

/** REST STEP */
class Boil extends Step {
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)
  }

  #boilInterval = 1000
  #start = false
  #heater = accurateInterval(async () => {
    if (this.#start) {
      this.io.Contactor2.autoOn()
      this.io.Heat2.autoOn()
      const sp = get(await getRedisStore(), 'settings.boil.setpoint', 0) / 100
      setTimeoutGlobal(() => {
        this.io.Heat2.autoOff()
      }, Math.max(0.0, sp * this.#boilInterval - 10))
    } else {
      this.io.Contactor2.autoOff()
      this.io.Heat2.autoOff()
    }
  }, this.#boilInterval, { aligned: true, immediate: false })

  async start() {
    this.parent.start.call(this)
    this.#start = true
  }

  async stop() {
    this.parent.stop.call(this)
    this.#heater.clear()
  }

  checkComplete() {
    if (get(this.step, 'stepTime', 0) > 0 && this.stepTime.value() > 0 && this.remainingTime.value() <= 0) {
      return true
    } else {
      return false
    }
  }
}
Boil.prototype.parent = Step.prototype

// ..######..##.....##.####.##.......##......
// .##....##.##.....##..##..##.......##......
// .##.......##.....##..##..##.......##......
// .##.......#########..##..##.......##......
// .##.......##.....##..##..##.......##......
// .##....##.##.....##..##..##.......##......
// ..######..##.....##.####.########.########

/** CHILLING STEP */
class Chill extends Step {
  constructor(step, recipeId, breweryIO) {
    super(step, recipeId, breweryIO)

    this.#stepTemp = step.setpoint
  }

  #stopDelay = false
  #stepTemp = 999
  #chiller = accurateInterval(async () => {
    // Get the RIMS temperature
    const { temp3 } = await this.io.readTemps()
    this.#stepTemp = temp3
  }, 1000, { aligned: true, immediate: true })

  /** Start the Chill step. During this step, the pump just continues to run. */
  async start() {
    this.parent.start.call(this)
    this.io.Pump1.autoOn()
  }

  /** Stop the Heat step. Shut the pump off. */
  async stop() {
    this.parent.stop.call(this)
    this.io.Pump1.autoOff()
    this.#chiller.clear()
  }

  checkComplete() {
    if (this.#stepTemp < this.step.setpoint && !this.#stopDelay) {
      this.#stopDelay = true
      this.emit('set snackbar message', {
        message: 'The wort has reached setpoint!',
        variant: 'success'
      })
    }
    return false
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
module.exports.Time = Time