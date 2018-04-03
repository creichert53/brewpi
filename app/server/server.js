const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')

const port = process.env.PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())
app.use(bodyParser.json())

const httpServer = http.createServer(app)
const io = socket(httpServer)

// Serve static bundle
app.get('/', function (req, res) {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

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
