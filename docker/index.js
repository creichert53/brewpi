var path = require('path')
var compose = require('../brewpi/node_modules/docker-compose')
var cmd = require('../brewpi/node_modules/node-cmd')

console.log(path.join(__dirname, '.'))
compose.down().then(() => {
  compose.upAll({ cwd: path.join(__dirname, '.'), log: true }).then(
    () => {
      compose.logs('flask', { follow: true }).then(logs => {
        console.log(logs.out)
      })
    },
    err => { console.log('something went wrong:', err.message)}
  )
})