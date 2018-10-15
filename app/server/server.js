const _ = require('lodash')
const r = require('rethinkdb')
const fs = require('fs')
const cron = require('cron')
const cors = require('cors')
const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const moment = require('moment')
const bodyParser = require('body-parser')
const Gpio = require('onoff').Gpio

const thermistor = require('./helpers/thermistor')
const Brew = require('./brew')
const types = require('../src/Redux/types')

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
  contactor2: new Gpio(18, 'out')
}

// const gpio_interval = setInterval(() => {
//   gpio.pump1.read((err, value) => {
//     if (err) { throw err }
//     gpio.pump1.write(value ^ 1, err => {
//       if (err) { throw err }
//     })
//   })
//   gpio.pump1.read((err, value) => {
//     if (err) { throw err }
//     gpio.pump1.write(value ^ 1, err => {
//       if (err) { throw err }
//     })
//   })
// }, 5000)

// setInterval(() => {
//   var start = moment().valueOf()
//   setTimeout(() => {
//     var end = moment().valueOf()
//     console.log(end - start)
//   }, 1000)
// }, 2000)

const httpServer = http.createServer(app)
const io = socket(httpServer)

// Emit the temperatures
const temp1 = new thermistor('temp1', 0)
const temp2 = new thermistor('temp2', 1)
const temp3 = new thermistor('temp3', 2)
function Temperatures() {
  this.value = {
    temp1: null,
    temp2: null,
    temp3: null
  }
  this.array = []
  this.addTemp = (stepId, timeInSeconds) => {
    if (Object.values(this.value).reduce((acc,val) => acc += val === null ? 1 : 0, 0) !== 3) {
      this.array.push({
        step: stepId,
        time: moment().add(500, 'ms').startOf('second').unix(),
        brewTime: timeInSeconds,
        ...this.value
      })
    }
    var filterTime = moment().subtract(5, 'h').unix()
    this.array = this.array.filter(val => val.time > filterTime)
    this.array = this.array.slice(0,60000)
  }
  this.reset = () => {
    this.array = []
  }
}
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
const initializeBrew = () => {
  if (store.value.recipe.startBrew) {
    brew.start()
  }
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
        delete result.temperatureArray
        store.value = result

        // On the startup, initialize the brew session
        if (initialize) {
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
  getStoreFromDatabase().then(() => {
    socket.emit('store initial state', store.value)
  })

  socket.on('action', (action) => {
    if (action.type === types.NEW_RECIPE || action.type === types.COMPLETE_STEP || action.type === types.START_BREW) {
      if (action.type === types.NEW_RECIPE) delete action.store.time
      updateStore(action.store ? Object.assign({}, action.store, { recipe: action.payload }, ) : store).then(() => {
        // If a new recipe is uploaded, stop any previous brew sessions.
        if (action.type === types.NEW_RECIPE) {
          // Re-initialize a brew session
          if (brew) brew.stop()
          temperatures.reset()
          io.emit('temp array', temperatures.array)
          brew = new Brew(io, store, temperatures, gpio, updateStore)
        }

        // Start brew if button is pressed
        if (action.type === types.START_BREW) {
          initializeBrew()
        }
      }).catch(err => console.log(err))
    }
    if (action.type === types.SETTINGS) {
      updateStore(action.store ? Object.assign({}, action.store, { settings: action.payload }) : store).catch(err => console.log(err))
    }
  })
})

// free gpio resources
process.on('SIGINT', function () {
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
