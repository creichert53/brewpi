const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')
const Gpio = require('onoff').Gpio
const cors = require('cors')
const fs = require('fs')
const r = require('rethinkdb')
const _ = require('lodash')
const thermistor = require('./helpers/thermistor')

const Brew = require('./brew')

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

const httpServer = http.createServer(app)
const io = socket(httpServer)

// Emit the temperatures
const temp1 = new thermistor('temp1', 0)
const temp2 = new thermistor('temp2', 1)
const temp3 = new thermistor('temp3', 2)
var temps = {
  temp1: null,
  temp2: null,
  temp3: null
}
temp1.on('new temperature', temp => {
  temps.temp1 = temp > 0 ? temp : null
  // io.emit('new temperature', 'temp1', temp > 0 ? temp : null)
})
temp2.on('new temperature', temp => {
  temps.temp2 = temp > 0 ? temp : null
  // io.emit('new temperature', 'temp2', temp > 0 ? temp : null)
})
temp3.on('new temperature', temp => {
  temps.temp3 = temp > 0 ? temp : null
  // io.emit('new temperature', 'temp3', temp > 0 ? temp : null)
})

// Get the initial store
var store = {}
r.connect({db: 'brewery'}).then(conn => {
  r.table('store').get('store').coerceTo('object').run(conn).then(results => {
    store = results
    conn.close()
  }).catch(err => {
    conn.close()
  })
})

app.post('/store', (req, res) => {
  console.log(`${new Date()} ${!_.isEqual(req.body.data.recipe, store.recipe)}`)
  if (!_.isEqual(req.body.data.recipe, store.recipe)) {
    console.log('Updating store')
    r.connect({db: 'brewery'}).then(conn => {
      const s = Object.assign({}, req.body.data)
      s.id = 'store'
      r.table('store').insert(s, { conflict: 'replace' }).run(conn).then(results => {
        conn.close()
        store = req.body.data
        io.emit('store initial state', store)
        return res.json({ success: true })
      }).catch(err => {
        conn.close()
        return res.json({ success: false })
      })
    })
  }
})

app.get('/temperatures', (req, res) => {
  return res.json(temps)
})

// Create a brew-session
var brew = new Brew(io, store, gpio)

// Serve static bundle
app.get('/', (req, res) => {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

httpServer.listen(port, () => {
  console.log(`HTTP Server is listening on port ${port}`)
})

io.on('connection', function (socket) {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('store').get('store').coerceTo('object').run(conn).then(result => {
      conn.close()
      store = result
      socket.emit('store initial state', store)
      conn.close()
    }).catch(err => {
      console.log(err)
      conn.close()
    })
  })

  socket.on('action', (action) => {
    if (action.type === 'server/new_recipe') {
      socket.emit('action', {type: 'NEW_RECIPE', payload: action.payload })
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

  process.exit(0)
})
