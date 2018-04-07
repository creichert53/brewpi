const httpProxy = require('http-proxy')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')
const r = require('rethinkdb')

const port = process.env.PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())
app.use(bodyParser.json())

const httpServer = httpProxy.createServer({
  target: `ws://localhost:${port}`,
  ws: true
}, app)
const io = socket(httpServer)

app.get('/store', (req, res) => {
  console.log(req.body)
})

// Serve static bundle
app.get('/', (req, res) => {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

console.log(`Port: ${port}`)
httpServer.listen(port, () => {
  console.log(`HTTP Server is listening on port ${port}`)
})

io.on('connection', function (socket) {
  socket.on('action', (action) => {
    if (action.type === 'server/new_recipe') {
      socket.emit('action', {type: 'NEW_RECIPE', payload: action.payload })
    }
  })
})
