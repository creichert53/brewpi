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

const server = http.createServer(app)
const io = socket(server)

app.get('/ping', function (req, res) {
 return res.send('pong')
})

app.post('/recipe', (req, res) => {
  console.log(JSON.stringify(req.body,null,2))
  return res.send('it worked')
})

app.get('/', function (req, res) {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

server.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})

io.on('connection', function (socket) {
  socket.on('action', (action) => {
    if(action.type === 'server/hello'){
      console.log('Got hello data!', action.payload);
      socket.emit('action', {type:'message', payload:'good day!'});
    }
  })
})
