const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const r = require('rethinkdb')

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

var store = {}
app.post('/store', (req, res) => {
  r.connect({db: 'brewery'}).then(conn => {
    r.table('store').insert({
      id: 'store',
      ...req.body.data
    }, { conflict: 'replace' }).run(conn).then(results => {
      conn.close()
      store = req.body.data
      return res.json({ success: true })
    }).catch(err => {
      conn.close()
      return res.json({ success: false })
    })
  })
})

// Serve static bundle
app.get('/', (req, res) => {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

httpServer.listen(port, () => {
  console.log(`HTTP Server is listening on port ${port}`)
})

io.on('connection', function (socket) {
  console.log('We have a connection!')
  r.connect({db: 'brewery'}).then(conn => {
    r.table('store').get('store').coerceTo('object').run(conn).then(result => {
      conn.close()
      store = result
      socket.emit('store initial state', store)
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
