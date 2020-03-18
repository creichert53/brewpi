const BreweryIO = new (require('../helpers/BreweryIO'))()

const snooze = ms => new Promise(resolve => setTimeout(resolve, ms));

setInterval(async () => {
  const temps = await BreweryIO.readTemps()
  if (BreweryIO.Pump1.currentValue() === 0) {
    BreweryIO.Pump1.setOn()
  } else {
    BreweryIO.Pump1.setOff()
  }
}, 5000)

const run = async () => {
  console.log('Running in Auto')
  await snooze(5000)
  console.log('Turn On')
  BreweryIO.Pump1.overrideOn()
  await snooze(5000)
  console.log('Turn Off')
  BreweryIO.Pump1.overrideOff()
  await snooze(5000)
  console.log('Back in Auto')
  BreweryIO.Pump1.auto()
  await snooze(10000)
};

run()