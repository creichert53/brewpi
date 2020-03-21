const Recipe = require('./service/Recipe')

// const redis = require('redis')
// const Promise = require('bluebird')
// const moment = require('moment')
// const { last } = require('lodash')

// Promise.promisifyAll(redis.RedisClient.prototype)

// ;(async () => {
//   const start = moment()
//   const client = redis.createClient()
//   const list = await client.lrangeAsync('temps', 0, 7200)
//   const temps = list.map(JSON.parse)
//   console.log(`${temps.length} items`)
//   console.log(last(temps))
//   console.log(moment().diff(start, 'millisecond'))
//   client.quit()
// })()

const recipe = new Recipe()

// const ProgressPromise = require('progress-promise')

// function longTask() {
//   return new ProgressPromise((resolve, reject, progress) => {
//     setTimeout(() => progress({
//       time: 0,
//       count: 0
//     }), 250);
//     setTimeout(() => progress({
//       time: 1,
//       count: 1
//     }), 500);
//     setTimeout(() => progress({
//       time: 2,
//       count: 2
//     }), 750);
//     setTimeout(resolve, 1000);
//   })
// }

// longTask()
//   .progress(console.log)
//   .then(() => console.log('finished'))