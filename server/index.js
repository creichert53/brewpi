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
const { debounce, cloneDeep, meanBy, set } = require('lodash')
const Recipe = require('./service/Recipe')
const logger = require('./service/logger')
const {
  completeNodeInRecipe,
  updateStoreOnChange
} = require('./service/utility')
const moment = require('moment')

// adjust the global timeout functionality so all timeouts can be cleared from anywhere
require('./service/timeout')

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

// Initialize variables
var client = redis.createClient()

const formatNivoTempArray = async (tempArray) => {
  // Moving average for a 3 second window
  const sma = array => {
    let cloned = cloneDeep(array)
    for (var i = 3; i < cloned.length; i++) {
      cloned[i].y = meanBy(cloned.slice(i - 3, i + 1), 'y')
    }
    return cloned.slice(6)
  }

  // Reformat the simple array of temperature informtion to something Nivo Charts can use.
  const { settings: { temperatures: t }} = JSON.parse(await client.getAsync('store'))
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

var recipe = new Recipe()
var tempLogger = new cron({
  cronTime: '*/1 * * * * *',
  onTick: async () => {

    // Set the temps in the temporary store
    const temps = await recipe.io.readTemps()

    try {
      await client.setAsync('temps', JSON.stringify(temps))
  
      // emit the temps and times to the frontent
      io.emit('new temperature', temps)

      // get the chart window from settings so we can determine how many temps to read
      const { settings: { temperatures: { chartWindow }}} = JSON.parse(await client.getAsync('store'))
  
      // Nivo Chart
      var tempArray = await formatNivoTempArray(await client.lrangeAsync('temp_array', -(chartWindow * 60), -1) || [])
  
      // Send the chart data to the frontend
      io.emit('temp array', tempArray)
    } catch (error) {
      if (!error.message.includes('The connection is already closed.'))
        logger.error(error)
    }
  },
  start: true,
  runOnInit: true,
  timeZone: 'America/New_York'
})

const init = async () => {
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

  const recipeListen = async (recipe) => {
    recipe.on('output update', update => {
      io.emit('output update', update)
    })
    recipe.on('time', async ({ totalTime, stepTime, remainingTime }) => {
      // Set the times in the temporary store
      await client.setAsync('time', JSON.stringify({
        totalTime: totalTime.value(),
        stepTime: stepTime.value(),
        remainingTime: remainingTime.value()
      }, null, 2))
      const store = Object.assign({}, JSON.parse(await client.getAsync('store')), {
        time: {
          totalTime: totalTime.toString(),
          stepTime: stepTime.toString(),
          remainingTime: remainingTime.toString()
        }
      })
      await updateStoreOnChange(store)
      io.emit('time', store.time)
    })
    recipe.on('update recipe from server', _ => {
      logger.trace('Updating the frontend that program is moving to the next step.')
      io.emit('update recipe from server', recipe.value)
    })
    recipe.on('end', async () => {
      console.log('recipe completed')
    })
  }
  
  // Get the store that is saved on disk and set it in memory
  const { store } = await getStoreFromDatabase()
  await client.set('store', JSON.stringify(store, null, 2))

  // Get the time values that are saved in memory (this step assumes it's not a cold start)
  const times = await client.getAsync('time')

  // Create a new recipe object with the times loaded from memory
  recipe = new Recipe(store.recipe, times ? JSON.parse(times) : undefined) // blank recipe initializing type

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
    socket.emit('new temperature', JSON.parse(await client.getAsync('temps') || { temp1: 0, temp2: 0, temp3: 0 }))

    // FIXME Delete this section after testing. Just want to test sending temps to frontend
    socket.emit('temp array', await formatNivoTempArray(await client.lrangeAsync('temp_array', -900, -1) || []))

    // Send the initial states of all outputs
    recipe.io.outputsSync().forEach(out => io.emit('output update', out))

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

        // start a new recipe with new times
        recipe = new Recipe(payload)

        // Immediately after creating a new recipe, listen for events
        recipeListen(recipe)

        // Send the initial states of all outputs
        recipe.io.outputsSync().forEach(out => io.emit('output update', out))

        // Reset times last
        recipe.resetTimes()
      }

      /** START BREW */
      if (type === types.START_BREW) {
        logger.success(`Starting '${store.recipe.name}'`)
        await updateStoreOnChange({ ...cloneDeep(store), recipe: { ...cloneDeep(recipe.value), startBrew: true }})
        recipe.start()
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
      
      /** CHART WINDOW SETTINGS */
      if (type === types.CHART_WINDOW) {
        logger.success('Chart Window Updated')
        set(store, 'settings.temperatures.chartWindow', payload)
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
        const nextStep = await recipe.nextStep()
        logger.success(`Completing STEP ${id} -> ${nextStep.id}`)
        io.emit('update recipe from server', recipe.value) // value is updated in the nextStep function
      }

      /** COMPLETE TODO */
      if (type === types.COMPLETE_TODO) {
        const { id } = action
        logger.success(`Completing TODO ${id}`)
        const newRecipe = completeNodeInRecipe(payload, id)
        await updateStoreOnChange({ ...cloneDeep(store), recipe: newRecipe })
        io.emit('update recipe from server', newRecipe)
      }
    })
  })
}

init()

const server = httpServer.listen(port, () => {
  logger.info(`HTTP Server is listening on port ${port}`)
})

const kill = debounce(async () => {
  logger.info('Cleaning up long running tasks...')
  tempLogger.stop()
  io.close()
  await recipe.quit()
  await client.quitAsync()
  await new Promise((resolve) => {
    server.close(() => resolve())
  })
  setTimeout(() => process.exit(0), 1000)
}, 1000, { leading: true, trailing: false })
process.on('SIGINT', () => kill())