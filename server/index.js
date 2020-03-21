const r = require('rethinkdb')
const fs = require('fs')
const path = require('path')
const uuidv4 = require('uuid/v4')
const moment = require('moment')
const waitOn = require('wait-on')
const {
  cloneDeep,
  get
} = require('lodash')
const accurateInterval = require('accurate-interval')
// const Brew = require('./brew')
// const types = require('../src/Redux/types')
const {
  bootstrapDatabase,
  listenTemperatures,
  getStoreFromDatabase,
  updateStore,
  removeIncompleteTemps
} = require('./database/functions')
const uptime = require('./helpers/uptime')
const Recipe = require('./Recipe')

/** Start up the server application */
require('./app')

;(async () => {
  // first ensure that the database has been bootstrapped
  await bootstrapDatabase()

  // load up the uptime script that will log any reboots of the server
  uptime()

  /**
 *  IMPORTANT: the database must be open for this server to work
 */
  await waitOn({
    resources: ['tcp:localhost:28015'], // wait for rethinkdb to open
    interval: 100, // poll interval in ms, default 250ms
    timeout: 5000, // timeout in ms, default Infinity
  }).
  console.info('Database is open. Continue spinning up server.')

//   // Interval that will log the temperatures into the database
//   const logInterval = () => {
//     if (logTempsInterval !== null) logTempsInterval.clear()
//     return accurateInterval(function(scheduledTime) {
//       console.log(scheduledTime)
//     }, 1000, { aligned: true, immediate: true })
//   }

//   // Create a brew-session
//   var brew = null
//   var logTempsInterval = null
//   const initializeBrew = (tempArray) => {
//     temperatures.setRecipeId(get(store, 'value.recipe.id', null))

//     // Re-initialize a brew session
//     if (brew) brew.stop()
//     brew = new Brew(io, store, temperatures, GPIO.gpio, (st) => {
//       updateStore(st).then(s => emitStore(s)).catch(err => console.log(err))
//     }, tempArray || [], GPIO)

//     // If the brew has already been started, then start it back up
//     if (get(store, 'value.recipe.startBrew', false)) {
//       brew.start()
//     }

//     // Initialize temperature logging
//     logTempsInterval = get(store.value, 'settings.temperatures.logTemperatures', false) ? logInterval() : null
//   }

//   // Get the initial store
//   const store = (s) => {
//     this.value = s
//   }
//   const { store: initialStore } = await getStoreFromDatabase()
//   store.value = initialStore

//   // On the startup, initialize the brew session
//   initializeBrew(results.temperatureArray)
//   console.log('Brew initialized...')

//   // Emit the initial store
//   const emitStore = (s) => {
//     store.value = cloneDeep(s)
//     io.emit('store initial state', store.value)
//   }

  /** Open up a socket-io connection with the frontend */
  var recipe = null
  io.on('connection', function (socket) {
    console.log('Connected...')

    socket.on('disconnect', () => {
      console.log('disconnected')
    })

    socket.on('action', (action) => {
      /**
       * CHANGE IN STATE OF RECIPE
       */
      if (action.type === types.NEW_RECIPE || action.type === types.COMPLETE_STEP || action.type === types.START_BREW) {
        // remove the time object on a new recipe and set the recipe id for temperature logging
        if (action.type === types.NEW_RECIPE) {
          recipe = new Recipe(action.payload)
        }

        // update the store any time there is a change in step (i.e. new recipe, step is completed, etc)
        // updateStore(action.store ? {
        //   ...action.store,
        //   recipe: action.payload,
        //   elements: { boil: 0, rims: 0 }
        // } : store).then(s => {
        //   emitStore(s)
          
        //   // If a new recipe is uploaded, stop any previous brew sessions.
        //   if (action.type === types.NEW_RECIPE || action.type === types.START_BREW) {
        //     initializeBrew()
        //   }
        // }).catch(err => console.log(err))
      }
      
      /**
       * SETTINGS UPDATE
       */
      if (action.type === types.SETTINGS) {
        // // If the log temperature setting has changed, update the interval.
        // if (get(action, 'payload.temperatures.logTemperatures', false) !== get(store, 'value.settings.temperatures.logTemperatures', false)) {
        //   if (action.payload.temperatures.logTemperatures)
        //     logTempsInterval = logInterval()
        //   else
        //     logTempsInterval.clear()
        // }
        
        // updateStore(action.store ? { ...action.store, settings: action.payload } : store).then(s => {
        //   emitStore(s)
        // }).catch(err => console.log(err))
      }

      /**
       * CHART WINDOW UPDATED
       */
      if (action.type === types.CHART_WINDOW) {
        // var newStore = action.store ? { ...action.store } : store
        // newStore.settings.temperatures.chartWindow = action.payload
        // updateStore(newStore).then(s => emitStore(s)).catch(err => console.log(err))
        // getRecipeTemps(store.value.recipe.id, action.payload).then(temps => io.emit('temp array', temps))

        // // send the client the new temperature array.
        // var filterTime = moment().subtract(store.value.settings && store.value.settings.temperatures.chartWindow, 'm').unix()
      }

      /**
       * OVERRIDE OUTPUTS
       */
      if (action.type === types.UPDATE_OUTPUT) {
        // const outputs = action.store.io
        // outputs[action.index].value = action.payload
        // const newStore = action.store ? Object.assign({}, action.store, { io: outputs }) : store
        // updateStore(newStore).then(s => emitStore(s)).catch(err => console.log(err))

        // // Set the overrides object on gpio so all brew steps can take appropriate action
        // outputs.forEach((acc,output) => {
        //   if (output.value !== 0) GPIO.setOverride(output.name, output)
        // })

        // // Initially set the gpio to their correct state
        // newStore.io && newStore.io.forEach(val => {
        //   if (val.value !== 0) {
        //     GPIO.writeOutput(val.name, val.value === -1 ? 0 : 1)
        //   } else {
        //     GPIO.writeOutput(val.name, GPIO.auto[val.name])
        //   }
        // })
      }
    })
  })
})()

process.once('SIGUSR2', function () {
  process.kill(process.pid, 'SIGUSR2');
})
