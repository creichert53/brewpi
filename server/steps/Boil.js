var _ = require('lodash')
var math = require('mathjs')
var moment = require('moment-timezone')
var traverse = require('traverse')
var accurateInterval = require('accurate-interval')

var PID = require('../helpers/PID')
var step = require('./__step')
var CronJob = require('cron').CronJob

/**
 * no action taken by controller
 */

module.exports = class Boil extends step {
  constructor(options) {
    super(options)

    // Declare variables on this instance
    this.store = options.store
    this.setpoint = options.activeStep.setpoint
    this.step = options.activeStep
    this.time = options.time

    // Get variables from the store
    this.recipe = this.store.value.recipe
    this.settings = this.store.value.settings
    Object.keys(this.settings.boil).forEach(val => {
      this[val] = this.settings.boil[val]
    })

    // The heater interval
    this.heatInterval = null
    this.heatOffTimeout = null

    // Declare that variable to use inside other methods
    var gpio = options.GPIO
    var that = this

    // Start the heater loop
    this.startHeater = () => {
      setTimeout(() => {
        gpio.writeOutput('contactor2', 0)

        // start an interval that will control the heater element on and off
        that.heatInterval = accurateInterval(() => {
          gpio.writeOutput('heat2', 1)
          that.heatOffTimeout = setTimeout(() => {
            gpio.writeOutput('heat2', 0)
          }, that.setpoint / 100.0 * 1000)
        }, 1000, { aligned: true, immediate: true })
      }, 5000)
    }
    // Clear the heater loops and ensure the heater is off
    this.stopHeater = () => {
      if (that.heatInterval)
        that.heatInterval.clear()
      clearTimeout(that.heatOffTimeout)
      gpio.writeOutput('heat2', 1)
    }

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
        title: `${recipe.activeStep.title} - ${that.time.totalTime}`,
        complete: true
      }

      options.updateStore(Object.assign({}, this.store.value, { recipe: recipe }))
    }

    // Check complete
    this.checkComplete = () => {
      if (!this.recipe.activeStep.todos && this.stepTimer >= this.recipe.boil_time * 60) {
        this.completeStep()
      }
    }

    // Listen for settings changes
    this.on('tick', () => {
      this.time.setRemainingTime(this.activeStep.stepTime ? this.activeStep.stepTime * 60 - this.stepTimer : null)

      // On Each tick check
      this.checkComplete()

      // If settings change, update the setting on this
      Object.keys(this.settings.boil).forEach(val => {
        if (!_.isEqual(this[val], this.store.value.settings.boil[val])) {
          this[val] = this.store.value.settings.boil[val]
        }
      })
    })

    // Close the contactor
    this.on('start', () => {
      this.startHeater()
    })

    // On a signal to stop, turn heater components off. Dissipate heat from element and shut pump off.
    this.on('stop', () => {
      this.stopHeater()
      gpio.writeOutput('contactor2', 1)
    })

    // On a signal to pause, stop heating functions
    this.on('pause', () => {
      this.stopHeater()
    })

    // On a signal to resume, start the loop back up. Heating functions should resume from there.
    this.on('resume', () => {
      this.startHeater()
    })
  }
}
