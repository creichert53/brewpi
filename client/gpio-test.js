const mcpadc = require('mcp-spi-adc')
const _ = require('lodash')
const numeral = require('numeral')
const sma = require('moving-averages').sma
const EventEmitter = require( 'events' )

var name = 'Channel 0'
const value = 0
const tempArray = []
const maTempArray = []

const dataPointsPerSec = 15

const sensor = mcpadc.open(1, {speedHz: 20000}, function (err) {
  if (err) console.log(err)
  setInterval(() => {
    sensor.read(function (err, reading) {
      value = toTemperature(reading.rawValue)
    });
  }, 1000);
})

// Emit the temperature every second (randomized from 1.5 to 3 seconds so all 3 are not simultaneous)
const rand = Math.round(_.random(1.5, 3, true) * 1000)

const tempInterval = setInterval(() => {
  console.log('new temperature', value > 0 ? numeral(value).value() : null)
}, rand)

function temp() {
  return value
}

function tempArrayLength() {
  return tempArray.length
}

function toTemperature(reading) {
  var thisValue = reading

  var resistance = 10000 / (1023 / thisValue - 1)

  var steinhart
  steinhart = (1 / (Math.log(resistance / 10000) / 3892 + 1.0 / (25 + 273.15)) - 273.15) * 9/5 + 32

  tempArray.push(steinhart)
  if (tempArray.length == dataPointsPerSec) tempArray.shift()
  var sum = 0
  for (var i = 0; i < tempArray.length; i++) {
    sum += tempArray[i]
  }

  // maTempArray = sma(tempArray, 500, 10)
  // var temps = tempArray.map((val,i) => {
  //   return { org: val, ma: maTempArray[i] }
  // })
  // console.log(temps)

  return (sum/tempArray.length)
  // return _.last(tempArray)
}
