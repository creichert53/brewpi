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
app.use(helmet())
app.use(cors())
app.use(bodyParser.json())

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
})

const httpServer = http.createServer(app)
const io = socket(httpServer)

app.post('/store', (req, res) => {
  console.log(req.body)
  return res.json(req.body)
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
  socket.on('action', (action) => {
    if (action.type === 'server/new_recipe') {
      socket.emit('action', {type: 'NEW_RECIPE', payload: action.payload })
    }
  })
})
