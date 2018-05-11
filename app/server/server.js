const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fs = require('fs')
const r = require('rethinkdb')

const Brew = require('./brew')

const port = process.env.REACT_APP_SERVER_PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())
app.use(cors())
app.use(bodyParser.json())

// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// })

const httpServer = http.createServer(app)
const io = socket(httpServer)

// Get the initial store
function store() {
  this.value = {}
}
r.connect({db: 'brewery'}).then(conn => {
  r.table('store').get('store').coerceTo('object').run(conn).then(results => {
    store.value = results
    conn.close()
  }).catch(err => {
    conn.close()
  })
})

app.post('/store', (req, res) => {
  r.connect({db: 'brewery'}).then(conn => {
    const s = Object.assign({}, req.body.data)
    s.id = 'store'
    r.table('store').insert(s, { conflict: 'replace' }).run(conn).then(results => {
      conn.close()
      store.value = req.body.data
      return res.json({ success: true })
    }).catch(err => {
      conn.close()
      return res.json({ success: false })
    })
  })
})

// Create a brew-session
var brew = new Brew(io, store)

// Serve static bundle
app.get('/', (req, res) => {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

httpServer.listen(port, () => {
  console.log(`HTTP Server is listening on port ${port}`)
})
// wth
io.on('connection', function (socket) {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('store').get('store').coerceTo('object').run(conn).then(result => {
      conn.close()
      store.value = result
      socket.emit('store initial state', store.value)
    }).catch(err => {
      conn.close()
    })
  })

  socket.on('action', (action) => {
    if (action.type === 'server/new_recipe') {
      socket.emit('action', {type: 'NEW_RECIPE', payload: action.payload })
    }
  })
})
