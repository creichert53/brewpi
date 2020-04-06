const { cloneDeep } = require('lodash')
const traverse = require('traverse')
const redis = require('redis')
const uuid = require('uuid').v4
const { updateStore } = require('../database/functions')

/**
 * @param  {object} recipe The current recipe object
 * @param  {string} id The id of the node to complete
 * @return {object} Return the new recipe after setting the completed value in the node with id.
 */
module.exports.completeNodeInRecipe = (recipe, id) => traverse(cloneDeep(recipe)).map(function(node) {
  if (node && node.id === id) 
    this.update({ ...node, complete: true })
})

/** Post the current store to Redis and save to the database */
module.exports.updateStoreOnChange = async store => {
  const client = redis.createClient()
  await client.set('store', JSON.stringify(store, null, 2))
  await updateStore(store)
  client.quit()
}