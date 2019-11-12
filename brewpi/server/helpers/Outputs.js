const Gpio = require('onoff').Gpio

module.exports = function Outputs(io) {
  var gpio = {
    pump1: new Gpio(15, 'out'),
    pump2: new Gpio(23, 'out'),
    heat1: new Gpio(25, 'out'),
    heat2: new Gpio(24, 'out'),
    contactor1: new Gpio(14, 'out'),
    contactor2: new Gpio(18, 'out')
  }
  var auto = {
    pump1: 0,
    pump2: 0,
    heat1: 0,
    heat2: 0,
    contactor1: 0,
    contactor2: 0
  }
  var overrides = {}

  const emitToFrontend = () => {
    var keys = Object.keys(gpio)
    var gpioNew = []
    keys.forEach(key => {
      gpioNew.push({
        name: key,
        value: this.readOutputSync(key)
      })
    })
    io.emit('output update', gpioNew)
  }

  this.writeOutput = (key, value) => {
    gpio[key].writeSync(overrides[key] ? (overrides[key].value === -1 ? 0 : 1) : value)
    this.setAuto(key, value)
    emitToFrontend()
  }
  this.readOutputSync = (key) => {
    return gpio[key].readSync()
  }
  this.readOutput = (key) => {
    return new Promise((resolve, reject) => {
      gpio[key].read((err, value) => { // Asynchronous read
        if (err) reject(err)
        else resolve(value)
      })
    })
  }
  this.setAuto = (key, value) => {
    auto[key] = value
  }
  this.setOverride = (key, value) => {
    overrides[key] = value
  }
  this.getOverride = (key) => {
    return overrides[key]
  }
  this.unexportAll = () => {
    try {
      Object.keys(gpio).forEach(key => gpio[key].unexport())
    } catch (err) { console.error(err) }
  }
}