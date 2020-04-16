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
  completeRecipeTemps,
  removeIncompleteTemps
} = require('./database/functions')
const { debounce, cloneDeep, get, set } = require('lodash')
const Recipe = require('./service/Recipe')
const logger = require('./service/logger')
const {
  completeNodeInRecipe,
  setRedisStore,
  formatNivoTempArray,
  dbBackup
} = require('./service/utility')

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
let client = redis.createClient()

let recipe = new Recipe()
let tempLogger = new cron({
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
      if (await client.exists('temp_array')) {
        var tempArray = await formatNivoTempArray(await client.lrangeAsync('temp_array', -(chartWindow * 60), -1) || [])

        // Send the chart data to the frontend
        io.emit('temp array', tempArray)
      }
    } catch (error) {
      if (!error.message.includes('The connection is already closed.') && !error.message.includes('temperatures'))
        logger.error(error)
    }
  },
  start: false, // wait to start until database is bootstrapped
  timeZone: 'America/New_York'
})

/** Periodically back up in-memory store to disk. */
let backup = async () => {
  try {
    // Only backup the store if there is a running brew session
    // TODO need to make sure the brew session flag is set to stop once the brew session ends
    let store = JSON.parse(await client.getAsync('store'))
    let startBrew = get(store, 'recipe.startBrew', false)
    if (startBrew) await dbBackup()
  } catch (error) {
    if (!error.message.includes('The connection is already closed.') && !error.message.includes('temperatures'))
      logger.error(error)
  }
}
let dbBackupCron = new cron({
  cronTime: '0 */5 * * * *',
  onTick: () => backup(),
  start: false, // wait to start until database is bootstrapped
  timeZone: 'America/New_York'
})

const init = async () => {
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

  // first ensure that the database has been bootstrapped
  logger.success(await bootstrapDatabase())
  tempLogger.start() // We've made sure all tables that will be saved to exist
  dbBackupCron.start()

  // load up the uptime script that will log any reboots of the server
  uptime()

  /**
   * Listen to Emitter events from the Recipe class and take action.
   * 
   * @param {Recipe} recipe The Recipe class object
   */
  const recipeListen = async (recipe) => {
    // A GPIO update was initialted so update the frontend.
    recipe.on('output update', update => {
      io.emit('output update', update)
    })

    // The time has changed in the recipe. We need to keep track of total recipe time,
    // the duration of a step, and and time that is remaining in a step and send it to the frontend.
    recipe.on('time', time => {
      io.emit('time', time)
    })

    // Send an updated recipe value to the frontend so it is in sync with the server.
    recipe.on('update recipe from server', _ => {
      logger.trace('Updating the frontend that program is moving to the next step.')
      io.emit('update recipe from server', recipe.value)
    })

    // Send the snackbar message to the frontend so it can be shown to the user.
    recipe.on('set snackbar message', args => {
      logger.trace('Updating the frontend snackbar message.')
      io.emit('set snackbar message', args)
    })

    // Notify the frontend that the recipe has completed so it ca let the user know.
    recipe.on('end recipe', async () => {
      io.emit('set snackbar message', {
        message: 'All steps have been completed. Saving data...',
        variant: 'info'
      })
      await completeRecipeTemps(recipe.recipeId)
      io.emit('set snackbar message', {
        message: 'Recipe has been completed!',
        variant: 'success'
      })
      logger.success('RECIPE COMPLETED')

      // TODO Report for the brew
    })
  }
  
  // Get the store that is saved on disk and set it in memory
  const store = JSON.parse(await client.getAsync('store'))

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
    var initialStore = JSON.parse(await client.getAsync('store'))
    socket.emit('store initial state', initialStore)
    
    // Send the temps to the frontend on each new connection
    socket.emit('new temperature', JSON.parse(await client.getAsync('temps') || { temp1: 0, temp2: 0, temp3: 0 }))

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

        // end the previous recipe before continuing. need to quit all timers.
        await recipe.quit()

        // update the store
        store = await setRedisStore({ recipe: payload })

        // start a new recipe with new times
        recipe = new Recipe(payload)

        // Immediately after creating a new recipe, listen for events
        recipeListen(recipe)

        // Send the initial states of all outputs
        recipe.io.outputsSync().forEach(out => io.emit('output update', out))

        // Send default time to frontend
        let t = '00:00:00'
        io.emit('time', { totalTime: t, stepTime: t, remainingTime: t })

        // Clean up temp values that are not part of a completed recipe
        removeIncompleteTemps()

        await backup()
      }

      /** START BREW */
      if (type === types.START_BREW) {
        logger.success(`Starting '${store.recipe.name}'`)
        store = await setRedisStore({ recipe: { ...cloneDeep(recipe.value), startBrew: true }})
        recipe.start()

        await backup()
      }
      
      /** SETTINGS */
      if (type === types.SETTINGS) {
        logger.success('Settings Updated')
        const { proportional: kp, integral: ki, derivative: kd, maxOutput: max } = payload.rims
        recipe.currentStep.PID.setTuning(kp, ki, kd)
        recipe.currentStep.PID.setOutputLimits(recipe.currentStep.PID.outMin, max)
        store = setRedisStore({ settings: payload })

        await backup()
      }
      
      /** CHART WINDOW SETTINGS */
      if (type === types.CHART_WINDOW) {
        logger.success('Chart Window Updated')
        set(store, 'settings.temperatures.chartWindow', payload)
        store = setRedisStore({ settings: store.settings })

        await backup()
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
        logger.success(`Completing STEP ${id} -> ${get(nextStep, 'id', 'complete')}`)
        io.emit('update recipe from server', recipe.value) // value is updated in the nextStep function

        await backup()
      }

      /** COMPLETE TODO */
      if (type === types.COMPLETE_TODO) {
        const { id } = action
        logger.success(`Completing TODO ${id}`)
        const newRecipe = completeNodeInRecipe(payload, id)
        store = await setRedisStore({ recipe: newRecipe })
        io.emit('update recipe from server', newRecipe)

        await backup()
      }
      
      /** SYNC THE REDUX SNACKBARS WITH SERVER STATE */
      if (type.includes('SNACKBAR')) {
        io.emit('set snackbars', payload)
        store = await setRedisStore({ snackbars: payload })
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
  dbBackupCron.stop()
  io.close()
  await recipe.quit()
  await client.quitAsync()
  await new Promise((resolve) => {
    server.close(() => resolve())
  })
  setTimeout(() => process.exit(0), 1000)
}, 1000, { leading: true, trailing: false })
process.on('SIGINT', () => kill())