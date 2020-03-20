const cors = require('cors')
const http = require('http')
const path = require('path')
const socket = require('socket.io')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')

const port = process.env.REACT_APP_SERVER_PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())
app.use(cors())
app.use(bodyParser.json())

const httpServer = http.createServer(app)
const io = socket(httpServer, { origins: '*:*' })
const outputs = io.of('/outputs')

// Serve static bundle
app.get('/', (req, res) => {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

httpServer.listen(port, () => {
  console.log(`HTTP Server is listening on port ${port}`)
})

module.exports = app