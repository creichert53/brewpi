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
const exec = require('child_process').exec
const socket = require('socket.io')
const helmet = require('helmet')
const uuidv4 = require('uuid/v4')
const express = require('express')
const moment = require('moment')
const waitOn = require('wait-on')
const bodyParser = require('body-parser')
const accurateInterval = require('accurate-interval')

const Gpio = require('onoff').Gpio

const Temperatures = require('./helpers/Temperatures')
const Thermistor = require('./helpers/Thermistor')
const Brew = require('./brew')
const types = require('../src/Redux/types')

const get = require('lodash.get')

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

// Emit any new temperatures inserted into the database up to all frontends
r.connect({db: 'brewery'}).then(conn => {
  r.table('temperatures').changes().run(conn).then(cursor => {
    cursor.on('error', err => {
      console.error(err)
    })
    cursor.on('data', data => {
      if (data && data.new_val) {
        io.emit('temp array', data.new_val)
      }
    })
  })
})

// Execute a shell command from node
function execute(command) {
  return new Promise((resolve, reject) => {
    exec(command, function(error, stdout, stderr) {
      if (error) reject(stderr)
      else resolve(stdout)
    })
  })
}

// Get an object with raspberry pi uptime. We want to update the database every time the pi is rebooted.
var uptime = () => {
  return new Promise((resolve, reject) => {
    Promise.all([execute('uptime -s'), execute('uptime')]).then(result => {
      var now = moment.tz('America/New_York')
      var time = moment(result[0], 'YYYY-MM-DD HH:mm:ss').tz('America/New_York')
      var ms = moment(now,"DD/MM/YYYY HH:mm:ss").diff(moment(time,"DD/MM/YYYY HH:mm:ss"))
      var d = moment.duration(ms)
      var days = Math.floor(d.asDays())
      var s = `${days === 1 ? '1 day, ' : days > 1 ? days + ' days, ' : ''}${Math.floor(d.asHours() - 24 * days) + moment.utc(ms).format(":mm:ss")}`

      resolve({
        unix: time.unix(),
        time: time.toString(),
        id: time.format('YYYY-MM-DD h:mm:ss A'),
        detail: result[1].trim().replace(/(\r\n|\n|\r)/gm, ""),
        uptime: s
      })
    })
  })
}

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

  // Keep track of uptime
  new CronJob({
    cronTime: '* * * * * *',
    onTick: () => {
      r.connect({db: 'brewery'}).then(conn => {
        uptime().then(result => {
          r.table('reboots').insert(result, {conflict: 'replace'}).run(conn).finally(results => {
            conn.close()
          })
        })
      })
    },
    runOnInit: true,
    start: true
  })

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
  r.connect({db: 'brewery'}).then(conn => {
    r.table('store').get('store').coerceTo('object').run(conn).then(results => {
      store.value = results
      conn.close()
    }).catch(err => {
      conn.close()
    })
  })

  // Serve static bundle
  app.get('/', (req, res) => {
    res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
  })

  httpServer.listen(port, () => {
    console.log(`HTTP Server is listening on port ${port}`)
  })

  // Create a brew-session
  var brew = null
  var logTempsInterval = null
  const initializeBrew = () => {
    // If the brew has already been started, then start it back up
    if (get(store.value, 'recipe.startBrew', false)) {
      brew.start()
    }

    // Initialize temperature logging
    logTempsInterval = get(store.value, 'settings.temperatures.logTemperatures', false) ? logInterval() : null
  }

  // Update the store on the server
  const updateStore = (st) => {
    return new Promise(function(resolve, reject) {
      r.connect({db: 'brewery'}).then(conn => {
        const s = Object.assign({}, st)
        s.id = 'store'
        r.table('store').insert(s, { conflict: 'replace' }).run(conn).then(results => {
          conn.close()
          store.value = Object.assign({}, s)
          io.emit('store initial state', store.value)
          resolve()
        }).catch(err => {
          conn.close()
          reject()
        })
      })
    })
  }

  const getStoreFromDatabase = (initialize) => {
    return new Promise(function(resolve, reject) {
      r.connect({db: 'brewery'}).then(conn => {
        r.table('store').get('store').coerceTo('object').run(conn).then(result => {
          conn.close()
          store.value = result

          // On the startup, initialize the brew session
          if (initialize) {
            temperatures.setRecipeId(_.get(store, 'value.recipe.id', null))
            brew = new Brew(io, store, temperatures, gpio, updateStore)
            initializeBrew()
          }

          conn.close()
          resolve()
        }).catch(err => {
          console.log(err)
          conn.close()
          reject()
        })
      })
    })
  }
  getStoreFromDatabase(true).then(() => {
    console.log('Brew initialized...')
  })

  io.on('connection', function (socket) {
    console.log('Connected...')
    getStoreFromDatabase().then(() => {
      socket.emit('store initial state', store.value)
    })

    socket.on('disconnect', () => {
      console.log('disconnected')
    })

    socket.on('action', (action) => {
      if (action.type === types.NEW_RECIPE || action.type === types.COMPLETE_STEP || action.type === types.START_BREW) {
        // remove the time object on a new recipe and set the recipe id for temperature logging
        if (action.type === types.NEW_RECIPE) {
          delete action.store.time
          temperatures.setRecipeId(action.payload.id)
        }

        updateStore(action.store ? Object.assign({}, action.store, {
          recipe: action.payload,
          elements: {
            boil: 0,
            rims: 0
          }
        }, ) : store).then(() => {
          // If a new recipe is uploaded, stop any previous brew sessions.
          if (action.type === types.NEW_RECIPE) {
            // Re-initialize a brew session
            if (brew) brew.stop()
            brew = new Brew(io, store, temperatures, gpio, updateStore)
          }

          // Start brew if button is pressed
          if (action.type === types.START_BREW) {
            initializeBrew()
          }
        }).catch(err => console.log(err))
      }
      if (action.type === types.SETTINGS) {
        // If the log temperature setting has changed, update the interval.
        if (action.payload.temperatures &&
          store.value.settings.temperatures &&
          action.payload.temperatures.logTemperatures !== store.value.settings.temperatures.logTemperatures) {
          if (action.payload.temperatures.logTemperatures)
            logTempsInterval = logInterval()
          else
            logTempsInterval.clear()
        }
        updateStore(action.store ? Object.assign({}, action.store, { settings: action.payload }) : store).catch(err => console.log(err))
      }
      if (action.type === types.CHART_WINDOW) {
        var newStore = action.store ? Object.assign({}, action.store) : store
        newStore.settings.temperatures.chartWindow = action.payload
        updateStore(newStore).catch(err => console.log(err))

        // send the client the new temperature array.
        var filterTime = moment().subtract(store.value.settings && store.value.settings.temperatures.chartWindow, 'm').unix()
      }
      if (action.type === types.UPDATE_OUTPUT) {
        const outputs = action.store.io
        outputs[action.index].value = action.payload
        const newStore = action.store ? Object.assign({}, action.store, { io: outputs }) : store
        updateStore(newStore).catch(err => console.log(err))

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
