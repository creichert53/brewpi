const path = require('path')
const helmet = require('helmet')
const express = require('express')
const bodyParser = require('body-parser')

const port = process.env.PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())

app.get('/ping', function (req, res) {
 return res.send('pong')
})

app.get('/', function (req, res) {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`)
})
