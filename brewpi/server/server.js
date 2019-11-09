require('appmetrics-dash').monitor({
  url: '/monitor/server',
  port: 4000,
  title: 'Server'
})
const _ = require('lodash')
const r = require('rethinkdb')
const fs = require('fs')
const CronJob = require('cron').CronJob
const cors = require('cors')
const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const uuidv4 = require('uuid/v4')
const express = require('express')
const moment = require('moment')
const waitOn = require('wait-on')
const cloneDeep = require('lodash/cloneDeep')
const bodyParser = require('body-parser')
const accurateInterval = require('accurate-interval')

const Gpio = require('onoff').Gpio

const Temperatures = require('./helpers/Temperatures')
const Thermistor = require('./helpers/Thermistor')
const Brew = require('./brew')
const types = require('../src/Redux/types')
const dbFunctions = require('./database/functions')

const get = require('lodash.get')

// load up the uptime script that will log any reboots of the server
require('./helpers/uptime')

const port = process.env.REACT_APP_SERVER_PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())
app.use(cors())
app.use(bodyParser.json())

// Define the IO
var gpio = {
  pump1: new Gpio(15, 'out'),
  pump2: new Gpio(23, 'out'),
  heat1: new Gpio(25, 'out'),
  heat2: new Gpio(24, 'out'),
  contactor1: new Gpio(14, 'out'),
  contactor2: new Gpio(18, 'out'),
  auto: {
    pump1: 0,
    pump2: 0,
    heat1: 0,
    heat2: 0,
    contactor1: 0,
    contactor2: 0
  },
  overrides: {}
}

const httpServer = http.createServer(app)
const io = socket(httpServer, { origins: '*:*' })
const outputs = io.of('/outputs')

// keep the frontend io list up to date
setInterval(() => {
  var keys = Object.keys(gpio).slice(0,6)
  var gpioNew = []
  keys.forEach(key => {
    gpioNew.push({
      name: key,
      value: gpio[key].readSync()
    })
  })
  outputs.emit('output update', gpioNew)
}, 50)

// Start a changefeed to emit temperatures to the frontend
dbFunctions.emitTemperatures(io)

// Emit the temperatures
const temp1 = new Thermistor('temp1', 0)
const temp2 = new Thermistor('temp2', 1)
const temp3 = new Thermistor('temp3', 2)
var temperatures = new Temperatures()
temp1.on('new temperature', temp => {
  temperatures.value.temp1 = temp > 0 ? temp : null
})
temp2.on('new temperature', temp => {
  temperatures.value.temp2 = temp > 0 ? temp : null
})
temp3.on('new temperature', temp => {
  temperatures.value.temp3 = temp > 0 ? temp : null
})
setInterval(() => {
  io.emit('new temperature', { ...temperatures.value })
}, 1000)

waitOn({
  resources: ['tcp:localhost:28015'], // wait for rethinkdb to open
  interval: 100, // poll interval in ms, default 250ms
  timeout: 5000, // timeout in ms, default Infinity
}).then(() => {
  console.info('Database is open. Continue spinning up server.')
  /**
   *  IMPORTANT: the database must be open for this server to work
   */

  // Interval that will log the temperatures into the database
  const logInterval = () => {
    if (logTempsInterval !== null) logTempsInterval.clear()
    return accurateInterval(function(scheduledTime) {
      console.log(scheduledTime)
    }, 1000, { aligned: true, immediate: true })
  }

  // Get the initial store
  const store = (s) => {
    this.value = s
  }
  dbFunctions.getStoreFromDatabase().then(result => store.value = result.store)

  // Serve static bundle
  app.get('/', (req, res) => {
    res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
  })

  httpServer.listen(port, () => {
    console.log(`HTTP Server is listening on port ${port}`)
  })

  const emitStore = (s) => {
    store.value = cloneDeep(s)
    io.emit('store initial state', store.value)
  }

  // Create a brew-session
  var brew = null
  var logTempsInterval = null
  const initializeBrew = (tempArray) => {
    temperatures.setRecipeId(get(store, 'value.recipe.id', null))

    // Re-initialize a brew session
    if (brew) brew.stop()
    brew = new Brew(io, store, temperatures, gpio, (st) => {
      dbFunctions.updateStore(st).then(s => emitStore(s)).catch(err => console.log(err))
    }, tempArray || [])

    // If the brew has already been started, then start it back up
    if (get(store, 'value.recipe.startBrew', false)) {
      brew.start()
    }

    // Initialize temperature logging
    logTempsInterval = get(store.value, 'settings.temperatures.logTemperatures', false) ? logInterval() : null
  }

  dbFunctions.getStoreFromDatabase().then(results => {
    store.value = results.store

    // On the startup, initialize the brew session
    initializeBrew(results.temperatureArray)

    console.log('Brew initialized...')
  })

  io.on('connection', function (socket) {
    console.log('Connected...')
    io.emit('clear temp array')
    dbFunctions.getStoreFromDatabase().then(results => {
      socket.emit('store initial state', results.store)
      socket.emit('temp array', results.temperatureArray)
    })

    socket.on('disconnect', () => {
      console.log('disconnected')
    })

    socket.on('action', (action) => {
      // do not save the temperature array from redux to the database because that data already exists in another table
      if (_.get(action, 'store.temperatureArray', false)) 
        delete action.store.temperatureArray

      /**
       * CHANGE IN STATE OF RECIPE
       */
      if (action.type === types.NEW_RECIPE || action.type === types.COMPLETE_STEP || action.type === types.START_BREW) {
        // remove the time object on a new recipe and set the recipe id for temperature logging
        if (action.type === types.NEW_RECIPE) {
          delete action.store.time
          dbFunctions.removeIncompleteTemps()

          // notify the frontend to clear it's temperature array
          io.emit('clear temp array')
        }

        // update the store any time there is a change in step (i.e. new recipe, step is completed, etc)
        dbFunctions.updateStore(action.store ? {
          ...action.store,
          recipe: action.payload,
          elements: { boil: 0, rims: 0 }
        } : store).then(s => {
          emitStore(s)
          
          // If a new recipe is uploaded, stop any previous brew sessions.
          if (action.type === types.NEW_RECIPE || action.type === types.START_BREW) {
            initializeBrew()
          }
        }).catch(err => console.log(err))
      }
      
      /**
       * SETTINGS UPDATE
       */
      if (action.type === types.SETTINGS) {
        // If the log temperature setting has changed, update the interval.
        if (get(action, 'payload.temperatures.logTemperatures', false) !== get(store, 'value.settings.temperatures.logTemperatures', false)) {
          if (action.payload.temperatures.logTemperatures)
            logTempsInterval = logInterval()
          else
            logTempsInterval.clear()
        }
        
        dbFunctions.updateStore(action.store ? { ...action.store, settings: action.payload } : store).then(s => {
          emitStore(s)
        }).catch(err => console.log(err))
      }

      /**
       * CHART WINDOW UPDATED
       */
      if (action.type === types.CHART_WINDOW) {
        // var newStore = action.store ? { ...action.store } : store
        // newStore.settings.temperatures.chartWindow = action.payload
        // dbFunctions.updateStore(newStore).then(s => emitStore(s)).catch(err => console.log(err))
        // dbFunctions.getRecipeTemps(store.value.recipe.id, action.payload).then(temps => io.emit('temp array', temps))

        // // send the client the new temperature array.
        // var filterTime = moment().subtract(store.value.settings && store.value.settings.temperatures.chartWindow, 'm').unix()
      }

      /**
       * OVERRIDE OUTPUTS
       */
      if (action.type === types.UPDATE_OUTPUT) {
        const outputs = action.store.io
        outputs[action.index].value = action.payload
        const newStore = action.store ? Object.assign({}, action.store, { io: outputs }) : store
        dbFunctions.updateStore(newStore).then(s => emitStore(s)).catch(err => console.log(err))

        // Set the overrides object on gpio so all brew steps can take appropriate action
        gpio.overrides = outputs.reduce((acc,output) => {
          if (output.value !== 0) acc[output.name] = output
          return acc
        }, {})

        // Initially set the gpio to their correct state
        newStore.io && newStore.io.forEach(val => {
          if (val.value !== 0) {
            gpio[val.name].writeSync(val.value === -1 ? 0 : 1)
          } else {
            gpio[val.name].writeSync(gpio.auto[val.name])
          }
        })
      }
    })
  })
}).catch(err => {
  console.error(err)
})

process.once('SIGUSR2', function () {
  process.kill(process.pid, 'SIGUSR2');
})

// free gpio resources
process.on('SIGINT', function () {
  console.log('SIGINT')
  console.log('Freeing up GPIO resources')

  try {
    gpio.pump1.unexport()
    gpio.pump2.unexport()
    gpio.heat1.unexport()
    gpio.heat2.unexport()
    gpio.contactor1.unexport()
    gpio.contactor2.unexport()
  } catch (err) { console.log(err) }

  process.exit()
})
