const mcpadc = require('mcp-spi-adc')
const { defaults } = require('lodash')
const Gpio = require('onoff').Gpio

"use strict"
function Output(pin) {
  this.gpio = new Gpio(pin, 'out')
  this.isOverridden = false
  this.overrideValue = null
  this.autoValue = 0
}

Output.prototype.write = function() {
  this.gpio.writeSync(this.isOverridden ? this.overrideValue : this.autoValue)
}
Output.prototype.on = function() {
  this.autoValue = 1
  this.write()
}
Output.prototype.off = function() {
  this.autoValue = 0
  this.write()
}
Output.prototype.overrideOn = function() {
  this.overrideValue = 1
  this.isOverridden = true
  this.write()
}
Output.prototype.overrideOff = function() {
  this.overrideValue = 0
  this.isOverridden = true
  this.write()
}
Output.prototype.auto = function() {
  this.overrideValue = null
  this.isOverridden = false
  this.write()
}
Output.prototype.currentValue = function() {
  return this.gpio.readSync()
}

function BreweryIO() {
  this.Pump1 = new Output(15)
  this.Pump2 = new Output(23)
  this.Heat1 = new Output(25)
  this.Heat2 = new Output(24)
  this.Contactor1 = new Output(14)
  this.Contactor2 = new Output(18)
  process.on('SIGINT', _ => {
    this.Pump1.gpio.unexport()
    this.Pump2.gpio.unexport()
    this.Heat1.gpio.unexport()
    this.Heat2.gpio.unexport()
    this.Contactor1.gpio.unexport()
    this.Contactor2.gpio.unexport()
    process.exit(0)
  })
}

const open = (channel, options) => new Promise((resolve, reject) => {
  const sensor = mcpadc.open(channel, options || {}, err => {
    if (err) reject(err)
    else resolve(sensor)
  })
})

const read = (device) => new Promise((resolve, reject) => {
  device.read((err, reading) => {
    if (err) reject(err)
    else resolve(reading)
  })
})

const toTemperature = (value, options) => {
  const { Ro, To, beta } = defaults(options || {}, {
    Ro: 10000.0,
    To: 25.0,
    beta: 3892.0
  })
  if (value != 1023) {
    const resistance = Ro / (1023.0 / value - 1.0)
    steinhart = Math.log(resistance / Ro) / beta
    steinhart += 1.0 / (To + 273.15)
    steinhart = (1.0 / steinhart) - 273.15
    steinhart = steinhart * 9/5 + 32
    return steinhart
  } else {
    return null
  }
}

const getTemperature = (channel) => new Promise((resolve, reject) => {
  open(channel, { speedHz: 20000 }).then(sensor => {
    return read(sensor)
  }).then(({ rawValue }) => {
    resolve(toTemperature(rawValue))
  }).catch(err => {
    reject(err)
  })
})

BreweryIO.prototype.readTemps = async () => {
  const temp1 = await getTemperature(0)
  const temp2 = await getTemperature(1)
  const temp3 = await getTemperature(2)
  return { temp1, temp2, temp3 }
}

module.exports = BreweryIO