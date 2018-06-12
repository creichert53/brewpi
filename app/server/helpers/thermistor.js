const mcpadc = require('mcp-spi-adc')
const _ = require('lodash')
const EventEmitter = require( 'events' )

module.exports = class thermistor extends EventEmitter {
  constructor(name, sensorChannel) {
    super()

    this.name = name
    this.value = 0
    this.tempArray = []

    const that = this
    this.sensor = mcpadc.open(sensorChannel || 0, {speedHz: 20000}, function (err) {
      if (err) console.log(err)
      setInterval(() => {
        that.sensor.read(function (err, reading) {
          that.value = that.toTemperature(reading.rawValue)
        });
      }, 500);
    })

    // Emit the temperature every second (randomized from 1.5 to 3 seconds so all 3 are not simultaneous)
    const rand = Math.round(_.random(1.5, 3, true) * 1000)

    this.tempInterval = setInterval(() => {
      this.emit('new temperature', this.value)
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
    steinhart = resistance / 10000                         // (R/Ro)
    steinhart = Math.log(steinhart)                        // ln(R/Ro)
    steinhart /= 3892                                      // 1/B * ln(R/Ro)
    steinhart += 1.0 / (25 + 273.15)                       // + (1/To)
    steinhart = 1.0 / steinhart                            // Invert
    steinhart -= 273.15                                    // convert to C
    steinhart = steinhart * (9/5) + 32  // convert to F

    this.tempArray.push(steinhart)
    if (this.tempArray.length == 100) this.tempArray.shift()
    var sum = 0
    for (var i = 0; i < this.tempArray.length; i++) {
      sum += this.tempArray[i]
    }

    return (sum/this.tempArray.length).toFixed(1)
  }
}
