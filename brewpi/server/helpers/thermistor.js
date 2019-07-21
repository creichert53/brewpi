const mcpadc = require('mcp-spi-adc')
const _ = require('lodash')
const numeral = require('numeral')
const sma = require('moving-averages').sma
const EventEmitter = require( 'events' )

module.exports = class thermistor extends EventEmitter {
  constructor(name, sensorChannel) {
    super()

    this.name = name
    this.value = 0
    this.tempArray = []
    this.maTempArray = []

    this.dataPointsPerSec = 15

    const that = this
    this.sensor = mcpadc.open(sensorChannel || 0, {speedHz: 20000}, function (err) {
      if (err) console.log(err)
      setInterval(() => {
        that.sensor.read(function (err, reading) {
          that.value = that.toTemperature(reading.rawValue)
        });
      }, 1000 / that.dataPointsPerSec);
    })

    // Emit the temperature every second (randomized from 1.5 to 3 seconds so all 3 are not simultaneous)
    const rand = Math.round(_.random(1.5, 3, true) * 1000)

    this.tempInterval = setInterval(() => {
      this.emit('new temperature', this.value > 0 ? numeral(this.value).value() : null)
    }, rand)
  }

  temp() {
    return this.value
  }

  tempArrayLength() {
    return this.tempArray.length
  }

  toTemperature(reading) {
    var thisValue = reading

    var resistance = 10000 / (1023 / thisValue - 1)

    var steinhart
    steinhart = (1 / (Math.log(resistance / 10000) / 3892 + 1.0 / (25 + 273.15)) - 273.15) * 9/5 + 32

    this.tempArray.push(steinhart)
    if (this.tempArray.length == this.dataPointsPerSec) this.tempArray.shift()
    var sum = 0
    for (var i = 0; i < this.tempArray.length; i++) {
      sum += this.tempArray[i]
    }

    // this.maTempArray = sma(this.tempArray, 500, 10)
    // var temps = this.tempArray.map((val,i) => {
    //   return { org: val, ma: this.maTempArray[i] }
    // })
    // console.log(temps)

    return (sum/this.tempArray.length)
    // return _.last(this.tempArray)
  }
}
