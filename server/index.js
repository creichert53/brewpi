const r = require('rethinkdb')
const fs = require('fs')
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
const { debounce } = require('lodash')
const interval = require('accurate-interval')
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

// Interval to send temps to the frontend
const tempsTimer = interval(async () => {
  const temps = await recipe.io.readTemps()
  await client.set('temps', JSON.stringify(temps))
  io.emit('new temperature', temps)
}, 1000, {aligned: true, immediate: true})

;(async () => {
  // first ensure that the database has been bootstrapped
  await bootstrapDatabase()

  // load up the uptime script that will log any reboots of the server
  uptime()

  /**
 *  IMPORTANT: the database must be open for this server to work
 */
  await waitOn({
    resources: ['tcp:localhost:28015'], // wait for rethinkdb to open
    interval: 100, // poll interval in ms, default 250ms
    timeout: 5000, // timeout in ms, default Infinity
  })
  logger.info('Database is open. Continue spinning up server.')
  
  const { store: { recipe: initialRecipe }} = await getStoreFromDatabase()
  recipe = new Recipe(initialRecipe) // blank recipe initializing type
  recipe.on('output update', update => logger.info(update))
  
  /** Open up a socket-io connection with the frontend */
  io.on('connection', async (socket) => {
    // Connection and Disconnection from the frontend
    logger.info('Connected...')
    socket.on('disconnect', () => {
      logger.info('disconnected')
    })

    // Send the intial state of the store to the frontend
    var { store: initialStore } = await getStoreFromDatabase()
    socket.emit('store initial state', initialStore)
    
    // Send the temps to the frontend on each new connection
    const temps = await client.get('temps')
    socket.emit('new temperature', JSON.parse(temps))

    /**
     * * Actions
    */
    socket.on('action', async action => {
      var { type, types, payload, name, store } = action

      logger.warn(action.type)

      /** Post the current store to Redis */
      await client.set('store', JSON.stringify(store))

      /** NEW RECIPE */
      if (type === types.NEW_RECIPE) {
        // update the store
        store.recipe = payload
        await updateStore(store)

        // end the previous recipe
        await recipe.end()

        // start a new recipet
        recipe = new Recipe(payload)

        // track recipe events
        recipe.on('output update', update => logger.info(update))
        recipe.on('end', async () => {
          await recipe.end()
        })
      }
      
      /** SETTINGS */
      if (type === types.SETTINGS) {
        const { proportional: kp, integral: ki, derivative: kd, maxOutput: max } = payload.rims
        recipe.PID.setTuning(kp, ki, kd)
        recipe.PID.setOutputLimits(recipe.PID.outMin, max)
        store.settings = payload
        updateStore(store)
      }

      /** UPDATE OUTPUT */
      if (type === types.UPDATE_OUTPUT) {
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
        recipe.nextStep()
      }

      /** START BREW */
      if (type === types.START_BREW) {
        recipe.start()
      }
    })

    socket.on('start brew', async () => {
      recipe.start()
    })

    // /**
    //  * CHART WINDOW UPDATED
    //  */
    // if (action.type === types.CHART_WINDOW) {
    //   // var newStore = action.store ? { ...action.store } : store
    //   // newStore.settings.temperatures.chartWindow = action.payload
    //   // updateStore(newStore).then(s => emitStore(s)).catch(err => console.log(err))
    //   // getRecipeTemps(store.value.recipe.id, action.payload).then(temps => io.emit('temp array', temps))

    //   // // send the client the new temperature array.
    //   // var filterTime = moment().subtract(store.value.settings && store.value.settings.temperatures.chartWindow, 'm').unix()
    // }
  })
})()

const server = httpServer.listen(port, () => {
  logger.info(`HTTP Server is listening on port ${port}`)
})

const kill = debounce(async () => {
  logger.info('Cleaning up long running tasks...')
  tempsTimer.clear()
  io.close()
  await recipe.quit()
  await client.quitAsync()
  await new Promise((resolve) => {
    server.close(() => resolve())
  })
  setTimeout(() => process.exit(0), 1000)
}, 1000, { leading: true, trailing: false })
process.on('SIGINT', () => kill())