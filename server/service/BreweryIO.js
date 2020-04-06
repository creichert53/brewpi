const mcpadc = require('mcp-spi-adc')
const { defaults } = require('lodash')
const Gpio = require('onoff').Gpio
const { EventEmitter } = require('events')
const logger = require('./logger')

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

Output.prototype.write = function() {
  try {
    this.gpio.writeSync(
      this.isOverridden
        ? this.overrideValue
        : this.autoValue
    )
    this.emit('output update', this.details())
  } catch (error) {}
}
Output.prototype.autoOn = function() {
  this.autoValue = 1
  this.write()
}
Output.prototype.autoOff = function() {
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
    liveValue: this.currentValue()
  }
}

class BreweryIO extends EventEmitter {
  constructor() {
    super()
    
    /** Initialize the Brewery Outputs */
    this.Pump1 = new Output(15, 'Pump1', 'Pump 1')
    this.Pump2 = new Output(23, 'Pump2', 'Pump 2')
    this.Heat1 = new Output(25, 'Heat1', 'RIMS Tube Element')
    this.Heat2 = new Output(24, 'Heat2', 'Boil Kettle Element')
    this.Contactor1 = new Output(14, 'Contactor1', 'Contactor 1')
    this.Contactor2 = new Output(18, 'Contactor2', 'Contactor 2')
  
    /** Listen for Output Updates and send to the Frontend */
    this.Pump1.on('output update', details => this.emit('output update', details))
    this.Pump2.on('output update', details => this.emit('output update', details))
    this.Heat1.on('output update', details => this.emit('output update', details))
    this.Heat2.on('output update', details => this.emit('output update', details))
    this.Contactor1.on('output update', details => this.emit('output update', details))
    this.Contactor1.on('output update', details => this.emit('output update', details))

    this.Pump1.autoOff(),
    this.Pump2.autoOff(),
    this.Heat1.autoOff(),
    this.Heat2.autoOff(),
    this.Contactor1.autoOff(),
    this.Contactor2.autoOff()
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

/** Returns an array of output details with each object containing the displayName, the name, and the current output value.
 */
BreweryIO.prototype.outputsSync = function() {
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