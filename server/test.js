const Recipe = require('./service/Recipe')
// const cron = require('cron').CronJob
const BreweryIO = require('./service/BreweryIO')
// const PID = require('./service/PID')
const mockRecipe = require('./test/recipe.json')

// const timer = new cron({
//   cronTime: '*/1 * * * * *',
//   onTick: async () => {
//     console.log('Hello')
//   },
//   start: true,
//   timeZone: 'America/New_York'
// })

// const pid = new PID()
// pid.startLoop()
// pid.stopLoop()

const brewery = new BreweryIO()
brewery.Pump1.on()
brewery.unexportAll()

// const recipe = new Recipe(mockRecipe)
// recipe.end()

// setTimeout(() => {
//   timer.stop()
// }, 5000)