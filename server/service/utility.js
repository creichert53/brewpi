const r = require('rethinkdb')
const redis = require('redis')
const traverse = require('traverse')
const moment = require('moment')
const Promise = require('bluebird')
const { cloneDeep, set, meanBy } = require('lodash')
const { Time } = require('./Recipe')
const logger = require('./logger')

Promise.promisifyAll(redis.RedisClient.prototype)

/**
 * Take the temporary in-memory store and back it up to disk
 */
module.exports.dbBackup = async () => {
  let start = moment()
  let client = redis.createClient()
  let store = JSON.parse(await client.getAsync('store'))
  let time = JSON.parse(await client.getAsync('time'))
  let temperatures = JSON.parse(await client.getAsync('temps'))
  let temp_array = (await client.lrangeAsync('temp_array', -(60 * 10), -1)).map(JSON.parse) // backup the last 10 minutes of temp values
  let conn = await r.connect({db: 'brewery'})
  let changes = await r.table('store').update({
    ...cloneDeep(store),
    temperatures,
    time
  }, {
    returnChanges: true
  }).run(conn)
  await r.table('temperatures').insert(temp_array, { conflict: 'replace' }).run(conn)
  conn.close()
  client.quit()
  changes.replaced > 0
    ? logger.success(`Database backup successful! [${moment().diff(start,'milliseconds')} ms]`)
    : logger.warn('Database backup attempted. Nothing save to disk.')
}

/**
 * Find the node in the recipe with id equal the the one provided, and update it's complete flag to true.
 * @param  {object} recipe The current recipe object
 * @param  {string} id The id of the node to complete
 * @return {object} Return the new recipe after setting the completed value in the node with id.
 */
module.exports.completeNodeInRecipe = (recipe, id) => traverse(cloneDeep(recipe)).map(function(node) {
  if (node && node.id === id) 
    this.update({ ...node, complete: true })
})

/**
 * @param  {Time} totalTime The current total time of the recipe as a Time object.
 * @param  {Time} stepTime The step time for the current step as a Time object.
 * @param  {Time} remainingTime The remaining time for the current step as a Time object.
 */
module.exports.setRedisTime = async ({ totalTime = new Time(0), stepTime = new Time(0), remainingTime = new Time(0) }) => {
  let client = redis.createClient()
  let newStore = set(JSON.parse(await client.getAsync('store')), 'time', {
    totalTime: totalTime.toString(),
    stepTime: stepTime.toString(),
    remainingTime: remainingTime.toString()
  })
  await client.setAsync('time', JSON.stringify({
    totalTime: totalTime.value(),
    stepTime: stepTime.value(),
    remainingTime: remainingTime.value()
  }))
  await client.setAsync('store', JSON.stringify(newStore))
  client.quit()
}

module.exports.getRedisStore = async () => {
  // Get the settings from the redis store
  let client = redis.createClient()
  let store = JSON.parse(await client.getAsync('store'))
  client.quit()
  return store
}

/** Post the current store to Redis and save to the database */
module.exports.setRedisStore = async (updates) => {
  let client = redis.createClient()
  let existingStore = JSON.parse(await client.getAsync('store'))
  let newStore = {
    ...cloneDeep(existingStore),
    ...updates
  }
  await client.setAsync('store', JSON.stringify(newStore, null, 2))
  client.quit()
  return newStore
}

module.exports.formatNivoTempArray = async (tempArray) => {
  // Moving average for a 3 second window
  const sma = array => {
    let cloned = cloneDeep(array)
    for (var i = 3; i < cloned.length; i++) {
      cloned[i].y = meanBy(cloned.slice(i - 3, i + 1), 'y')
    }
    return cloned.slice(6)
  }

  // Reformat the simple array of temperature informtion to something Nivo Charts can use.
  let client = redis.createClient()
  const { settings: { temperatures: t }} = JSON.parse(await client.getAsync('store'))
  client.quit()
  const formattedArray = tempArray.reduce((acc,temp) => {
    const { timestamp, temp1, temp2, temp3 } = JSON.parse(temp)
    acc.temp1.data = acc.temp1.data.concat({ x: timestamp, y: temp1 })
    acc.temp2.data = acc.temp2.data.concat({ x: timestamp, y: temp2 })
    acc.temp3.data = acc.temp3.data.concat({ x: timestamp, y: temp3 })
    return acc
  }, {
    temp1: {
      id: t.thermistor1.name,
      data: []
    },
    temp2: {
      id: t.thermistor2.name,
      data: []
    },
    temp3: {
      id: t.thermistor3.name,
      data: []
    }
  })
  formattedArray.temp1.data = sma(formattedArray.temp1.data)
  formattedArray.temp2.data = sma(formattedArray.temp2.data)
  formattedArray.temp3.data = sma(formattedArray.temp3.data)

  return Object.values(formattedArray)
}