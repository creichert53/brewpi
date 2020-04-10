const { cloneDeep } = require('lodash')
const traverse = require('traverse')
const redis = require('redis')
const uuid = require('uuid').v4
const { updateStore, updateTimeInStore } = require('../database/functions')
const { Time } = require('./Recipe')

/**
 * @param  {object} recipe The current recipe object
 * @param  {string} id The id of the node to complete
 * @return {object} Return the new recipe after setting the completed value in the node with id.
 */
module.exports.completeNodeInRecipe = (recipe, id) => traverse(cloneDeep(recipe)).map(function(node) {
  if (node && node.id === id) 
    this.update({ ...node, complete: true })
})

module.exports.updateTimeInDatabase = async ({ totalTime = new Time(0), stepTime = new Time(0), remainingTime = new Time(0) }) => {
  const client = redis.createClient()
  let newStore = await updateTimeInStore({
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

/** Post the current store to Redis and save to the database */
module.exports.updateStoreOnChange = async store => {
  const client = redis.createClient()
  await client.set('store', JSON.stringify(store, null, 2))
  await updateStore(store)
  client.quit()
}