var _ = require('lodash')
var math = require('mathjs')
var moment = require('moment-timezone')
var traverse = require('traverse')

var PID = require('../helpers/pid')
var step = require('./__step')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class heat extends step {
  constructor(options) {
    super(options)

    // Declare variables on this instance
    this.store = options.store
    this.gpio = options.gpio
    this.setpoint = options.activeStep.setpoint
    this.step = options.activeStep
    this.time = options.time

    // Get variables from the store
    this.recipe = this.store.value.recipe
    this.settings = this.store.value.settings
    Object.keys(this.settings.rims).forEach(val => {
      this[val] = this.settings.rims[val]
    })

    // Declare that variable to use inside other methods
    var that = this

    // Pump must be running for the PID loop to work
    this.pid = new PID(options.pid)

    // Complete the Step
    this.completeStep = () => {
      var recipe = _.cloneDeep(this.recipe)
      traverse(recipe).forEach(function(val) {
        if (val && typeof val === 'object' && val.id && val.id === that.step.id) {
          this.update({
            ...val,
            complete: true
          })
        }
      })

      // set the active step
      const incompleteSteps = recipe.steps.filter(step => !step.complete)
      recipe.activeStep = incompleteSteps.length > 0 ? incompleteSteps[0] : {
        complete: true
      }

      options.updateStore(Object.assign({}, this.store.value, { recipe: recipe })).catch(err => console.log(err))
    }

    // Check complete
    this.checkComplete = (temp) => {
      if (temp >= this.step.setpoint) {
        this.completeStep()
      }
    }

    // Listen for settings changes
    this.on('tick', () => {
      this.time.setStepTime(this.stepTimer)
      this.time.setRemainingTime(null)

      // Once the mash tun has reached temperature, set the active step move to the next step
      var temp = (this.step && this.step.title === 'Heat Strike Water') ||
        (this.step && this.step.title === 'Heat Sparge Water')
        ? options.temperatures.value.temp2 // temp1
        : options.temperatures.value.temp2 // temp3

      // On Each tick check
      this.checkComplete(temp)

      // If settings change, update the setting on this
      Object.keys(this.settings.rims).forEach(val => {
        if (!_.isEqual(this[val], this.store.value.settings.rims[val])) {
          this[val] = this.store.value.settings.rims[val]

          // Take action on the updated setting
          switch(val) {
            case 'setpointAdjust':
              this.pid.setTarget(this[val] + this.setpoint)
              break
            case 'proportional':
              this.pid.setTuning(this[val], this.pid.ki, this.pid.kd)
              break
            case 'integral':
              this.pid.setTuning(this.pid.kp, this[val], this.pid.kd)
              break
            case 'derivative':
              this.pid.setTuning(this.pid.kp, this.pid.ki, this[val])
              break
            case 'maxOutput':
              this.pid.setOutputLimits(this.pid.outMin, this[val])
              break
            default:
              break
          }
        }
      })
    })

    // After a 5 second delay of switching to this step, close RIMS contactor
    // The 5 seconds is a buffer so the setTimeout function that shuts the pump down
    // in a noAction step doesn't coincide with the restart
    // Two seconds after contactor, start pump
    this.on('start', () => {
      setTimeout(() => {
        that.gpio.contactor1.writeSync(1)
        setTimeout(() => {
          that.gpio.pump1.writeSync(1)
        }, 2000)
      }, 5000)
      this.pid.startLoop()
    })

    // On a signal to stop, turn heater components off. Dissipate heat from element and shut pump off.
    this.on('stop', () => {
      this.pid.stopLoop()
    })

    // On a signal to pause, stop heating functions
    this.on('pause', () => {
      this.pid.stopLoop()
      this.gpio.heat1.writeSync(0)
    })

    // On a signal to resume, start the loop back up. Heating functions should resume from there.
    this.on('resume', () => {
      this.pid.startLoop()
    })

    // Output of PID every dt
    this.pid.on('output', output => {
      // Set the PID temperature
      this.pid.setInput(options.temperatures.value.temp2)

      // Ouput should be a ratio from 0-1
      var out = output / 100

      // Read the status of the pump output and then decide how to handle the heater output
      this.gpio.pump1.read((err,value) => {
        // If pump is on, allow PID loop to control heater
        // Else turn heater off
        if (value) {
          that.gpio.heat1.writeSync(1) // turn heater ON
          setTimeout(() => { // after output delay, turn heater OFF
            that.gpio.heat1.writeSync(0)
          }, Math.max(0, out * that.pid.getTimeInterval() - 10)) // Output * Ratio of Interval - 10 ms (prevent interval overlap)
        } else {
          that.gpio.heat1.writeSync(0)
        }
      })
    })
  }
}
