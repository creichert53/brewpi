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

app.get('/ping', function (req, res) {
 return res.send('pong')
})

app.post('/recipe', (req, res) => {
  console.log(JSON.stringify(req.body,null,2))
  return res.send('it worked')
})

app.get('/', function (req, res) {
  console.log('Hello world')
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

httpServer.listen(port, () => {
  console.log(`HTTP Server is listening on port ${port}`)
})

io.on('connection', function (socket) {
  socket.on('action', (action) => {
    if(action.type === 'server/hello'){
      console.log('Got hello data!', action.payload);
      socket.emit('action', {type:'message', payload:'good day!'});
    }
  })
})
