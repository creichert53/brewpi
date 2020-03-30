const r = require('rethinkdb')
const fs = require('fs')
const cron = require('cron').CronJob
const cors = require('cors')
const http = require('http')
const path = require('path')
const redis = require('redis')
const uptime = require('./service/uptime')
const socket = require('socket.io')
const helmet = require('helmet')
const waitOn = require('wait-on')
const express = require('express')
const bodyParser = require('body-parser')
const Promise = require('bluebird')
const {
  bootstrapDatabase,
  listenTemperatures,
  getStoreFromDatabase,
  updateStore,
  removeIncompleteTemps
} = require('./database/functions')
const { debounce, cloneDeep } = require('lodash')
const interval = require('accurate-interval')
const traverse = require('traverse')
const Recipe = require('./service/Recipe')
const logger = require('./service/logger')

const port = process.env.REACT_APP_SERVER_PORT || 3001

const app = express()
app.use(express.static(path.resolve(path.join(__dirname, '../', 'build'))))
app.use(helmet())
app.use(cors())
app.use(bodyParser.json())

const httpServer = http.createServer(app)
const io = socket(httpServer, { origins: '*:*' })

// Serve static bundle
app.get('/', (req, res) => {
  res.sendFile(path.resolve(path.join(__dirname, '../', 'build', 'index.html')))
})

// Initialize the Redis client to log certain values in memory
Promise.promisifyAll(redis.RedisClient.prototype)
var client = redis.createClient()

var recipe = new Recipe()

// Interval to send times and temps to the frontend
const tempLogger = new cron({
  cronTime: '*/1 * * * * *',
  onTick: async () => {
    // Set the temps in the temporary store
    const temps = await recipe.io.readTemps()
    await client.setAsync('temps', JSON.stringify(temps))

    // emit the temps and times to the frontent
    io.emit('new temperature', temps)
  },
  start: true,
  runOnInit: true,
  timeZone: 'America/New_York'
})
const timeLogger = new cron({
  cronTime: '*/1 * * * * *',
  onTick: async () => {
    // Set the times in the temporary store
    const times = {
      totalTime: recipe.totalTime.value(),
      stepTime: recipe.currentStep.stepTime.value(),
      remainingTime: recipe.currentStep.remainingTime.value()
    }
    await client.setAsync('time', JSON.stringify(times, null, 2))
    
    io.emit('time', {
      totalTime: recipe.totalTime.toString(),
      stepTime: recipe.currentStep.stepTime.toString(),
      remainingTime: recipe.currentStep.remainingTime.toString()
    })
  },
  start: false,
  timeZone: 'America/New_York'
}) 

const updateTodoInRecipe = (recipe, id) => traverse(cloneDeep(recipe)).map(function(node) {
  if (node && node.id === id) {
    this.update({ ...node, complete: true })
  }
})
const updateStepInRecipe = (recipe, id) => updateTodoInRecipe(recipe, id)

;(async () => {
  // first ensure that the database has been bootstrapped
  await bootstrapDatabase()

  // load up the uptime script that will log any reboots of the server
  uptime()

  /**
 *  IMPORTANT: the database must be open for this server to work
 */
  logger.warn('Waiting on rethinkdb and redis...')
  await waitOn({
    resources: ['tcp:localhost:28015', 'tcp:localhost:6379'], // wait for rethinkdb to open
    interval: 100, // poll interval in ms, default 250ms
    timeout: 5000, // timeout in ms, default Infinity
  })
  logger.info('Databases are open. Continue spinning up server.')
  
  const updateStoreOnChange = async store => {
    /** Post the current store to Redis and save to the database */
    await client.set('store', JSON.stringify(store, null, 2))
    await updateStore(store)
  }

  const recipeListen = async (recipe) => {
    recipe.on('output update', update => logger.info(update))
    recipe.on('end', async () => {
      await recipe.end()
    })
  }
  
  // Get the store that is saved on disk and set it in memory
  const { store } = await getStoreFromDatabase()
  await client.set('store', JSON.stringify(store, null, 2))

  // Get the time values that are saved in memory (this step assumes it's not a cold start)
  const times = await client.getAsync('time')

  // Create a new recipe object with the times loaded from memory
  recipe = new Recipe(store.recipe, times ? JSON.parse(times) : undefined) // blank recipe initializing type

  // Now that the times have been read and fed into the initial recipe create, start the time logger back up
  timeLogger.start()

  // Listen for emitter events
  recipeListen(recipe)
  
  /** Open up a socket-io connection with the frontend */
  io.on('connection', async (socket) => {
    // Connection and Disconnection from the frontend
    logger.info('Connected...')
    socket.on('disconnect', () => {
      logger.info('Disconnected...')
    })

    // Send the intial state of the store to the frontend
    var storeString = await client.getAsync('store')
    var initialStore = JSON.parse(storeString)
    socket.emit('store initial state', initialStore)
    
    // Send the temps to the frontend on each new connection
    const temps = await client.getAsync('temps')
    socket.emit('new temperature', JSON.parse(temps || { temp1: 0, temp2: 0, temp3: 0 }))

    /**
     * * Actions
    */
    socket.on('action', async action => {
      var { type, types, payload, store } = action

      logger.trace(action.type)

      /** NEW RECIPE */
      if (type === types.NEW_RECIPE) {
        logger.success('New Recipe Imported')

        // update the store
        store.recipe = payload
        updateStoreOnChange(store)

        // end the previous recipe
        await recipe.end()

        // start a new recipet
        recipe = new Recipe(payload)

        // track recipe events
        recipeListen(recipe)
      }
      
      /** SETTINGS */
      if (type === types.SETTINGS) {
        logger.success('Settings Updated')
        const { proportional: kp, integral: ki, derivative: kd, maxOutput: max } = payload.rims
        recipe.PID.setTuning(kp, ki, kd)
        recipe.PID.setOutputLimits(recipe.PID.outMin, max)
        store.settings = payload
        updateStoreOnChange(store)
      }

      /** UPDATE OUTPUT */
      if (type === types.UPDATE_OUTPUT) {
        const { name } = action
        logger.success(`Manually Updating Output: ${name} -> ${payload === -1 ? 'Off' : payload === 1 ? 'On' : 'Auto'}`)

        if (payload === -1) {
          recipe.io[name].overrideOff()
        } else if (payload == 1) {
          recipe.io[name].overrideOn()
        } else {
          recipe.io[name].auto()
        }
      }

      /** COMPLETE STEP */
      if (type === types.COMPLETE_STEP) {
        const { id } = action
        const newRecipe = updateStepInRecipe(payload, id)
        recipe.value = newRecipe
        const nextStep = recipe.nextStep()
        logger.success(`Completing STEP ${id} -> ${nextStep.id}`)
        io.emit('update recipe from server', newRecipe)
        await updateStoreOnChange({ ...cloneDeep(store), recipe: newRecipe })
      }

      /** COMPLETE TODO */
      if (type === types.COMPLETE_TODO) {
        const { id } = action
        logger.success(`Completing TODO ${id}`)
        const newRecipe = updateTodoInRecipe(payload, id)
        await updateStoreOnChange({ ...cloneDeep(store), recipe: newRecipe })
        io.emit('update recipe from server', newRecipe)
      }

      /** START BREW */
      if (type === types.START_BREW) {
        logger.success(`Starting '${store.recipe.name}'`)
        await updateStoreOnChange({ ...cloneDeep(store), recipe: { ...cloneDeep(recipe.value), startBrew: true }})
        recipe.start()
      }
    })
  })
})()

const server = httpServer.listen(port, () => {
  logger.info(`HTTP Server is listening on port ${port}`)
})

const kill = debounce(async () => {
  logger.info('Cleaning up long running tasks...')
  tempLogger.stop()
  timeLogger.stop()
  io.close()
  await recipe.quit()
  await client.quitAsync()
  await new Promise((resolve) => {
    server.close(() => resolve())
  })
  setTimeout(() => process.exit(0), 1000)
}, 1000, { leading: true, trailing: false })
process.on('SIGINT', () => kill())