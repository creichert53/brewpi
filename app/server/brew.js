var _ = require('lodash')
var CronJob = require('cron').CronJob
var _0_prepareStrikeWater = require('./steps/_0_prepareStrikeWater')

module.exports = class Brew {
  constructor(io, store, gpio) {
    // construct the variables for the brew session
    this.io = io
    this.store = store
    this.gpio = gpio
    this.previousStore = store.value
    this.activeStep = null
    this.stepClass = null

    this.stepTimerEmit = (data) => {
      this.io.emit('step timer', data)
    }

    // declare the outputs
    // this.pump1 =

    // Create a default CronJob that will run every second and update the store any time there is a change in the active step
    this.storeJob = new CronJob({
      cronTime: '*/1 * * * * *',
      onTick: () => {
        if (!_.isEqual(
          this.store.value && this.store.value.recipe && this.store.value.recipe.activeStep && this.store.value.recipe.activeStep.id,
          this.previousStore && this.previousStore.recipe && this.previousStore.recipe.activeStep && this.previousStore.recipe.activeStep.id
        )) {
          this.previousStore = this.store.value

          // the current active step
          this.activeStep = this.store.value.recipe.activeStep

          // if a current step is running, finish it up
          if (this.stepClass && this.stepClass.isRunning)
            this.stepClass.finish()

          // Call the correct step
          if (this.activeStep) {
            switch(this.activeStep.type) {
              case 'PREPARE_STRIKE_WATER':
                console.log('Preparing strike water...')
                this.stepClass = new _0_prepareStrikeWater({
                  io: this.io,
                  activeStep: this.activeStep
                })
                break
              case 'PREPARE_FOR_HTL_HEAT':
                console.log(1)
                break
              case 'ADD_WATER_TO_MASH_TUN':
                console.log(2)
                break
              case 'PREPARE_FOR_MASH_RECIRC':
                console.log(3)
                break
              case 'RECIRC_MASH':
                console.log(4)
                break
              case 'ADD_INGREDIENTS':
                console.log(5)
                break
              case 'HEATING':
                console.log(6)
                break
              case 'RESTING':
                console.log(7)
                break
            }
          }

          this.stepClass.start()
        } else {
          // set the active step every second which will be propagated to the step classes
          this.activeStep = this.store.value && this.store.value.recipe && this.store.value.recipe.activeStep && this.store.value.recipe.activeStep.id
            ? this.store.value.recipe.activeStep
            : this.activeStep
        }
      },
      start: true,
      timeZone: 'America/New_York',
      runOnInit: true
    })
  }
}
