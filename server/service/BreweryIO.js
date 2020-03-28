const mcpadc = require('mcp-spi-adc')
const { defaults } = require('lodash')
const Gpio = require('onoff').Gpio
const { EventEmitter } = require('events')

class Output extends EventEmitter {
  constructor (pin, name, displayName) {
    super()
    this.gpio = new Gpio(pin, 'out')
    this.isOverridden = false
    this.overrideValue = null
    this.autoValue = 0
    this.name = name
    this.displayName = displayName
  }
}

Output.prototype.write = function(where) {
  this.gpio.writeSync(this.isOverridden ? this.overrideValue : this.autoValue)
  this.emit('update', this.details())
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
Output.prototype.details = function() {
  return {
    displayName: this.displayName,
    name: this.name,
    liveValue: this.isOverridden && this.currentValue()
      ? 1
      : this.isOverridden && !this.currentValue()
      ? -1
      : 0
  }
}

class BreweryIO extends EventEmitter {
  constructor(uuid) {
    super()
    
    /** Initialize the Brewery Outputs */
    this.Pump1 = new Output(15, 'pump1', 'Pump 1')
    this.Pump2 = new Output(23, 'pump2', 'Pump 2')
    this.Heat1 = new Output(25, 'heat1', 'RIMS Tube Element')
    this.Heat2 = new Output(24, 'heat2', 'Boil Kettle Element')
    this.Contactor1 = new Output(14, 'contactor1', 'Contactor 1')
    this.Contactor2 = new Output(18, 'contactor2', 'Contactor 2')
  
    /** Listen for Output Updates and send to the Frontend */
    this.Pump1.on('update', details => this.emit('output update', details))
    this.Pump2.on('update', details => this.emit('output update', details))
    this.Heat1.on('update', details => this.emit('output update', details))
    this.Heat2.on('update', details => this.emit('output update', details))
    this.Contactor1.on('update', details => this.emit('output update', details))
    this.Contactor1.on('update', details => this.emit('output update', details))
  
    /** When initializing new BreweryIO object, turn the outputs off */
    this.Pump1.off()
    this.Pump2.off()
    this.Heat1.off()
    this.Heat2.off()
    this.Contactor1.off()
    this.Contactor2.off()
  }
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

BreweryIO.prototype.unexportAll = function() {
  // return new Promise((resolve, reject) => {
    this.Pump1.gpio.unexport()
    this.Pump2.gpio.unexport()
    this.Heat1.gpio.unexport()
    this.Heat2.gpio.unexport()
    this.Contactor1.gpio.unexport()
    this.Contactor2.gpio.unexport()
    // resolve()
  // })
}

BreweryIO.prototype.outputs = function() {
  return [
    this.Pump1.details(),
    this.Pump2.details(),
    this.Heat1.details(),
    this.Heat2.details(),
    this.Contactor1.details(),
    this.Contactor2.details()
  ]
}

module.exports = BreweryIO