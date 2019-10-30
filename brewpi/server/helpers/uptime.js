const r = require('rethinkdb')
const exec = require('child_process').exec
const moment = require('moment-timezone')
const CronJob = require('cron').CronJob

// Execute a shell command from node
var execute = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, function(error, stdout, stderr) {
      if (error) reject(stderr)
      else resolve(stdout)
    })
  })
}

// Get an object with raspberry pi uptime. We want to update the database every time the pi is rebooted.
var uptime = () => {
  return new Promise((resolve, reject) => {
    Promise.all([execute('uptime -s'), execute('uptime')]).then(result => {
      var now = moment.tz('America/New_York')
      var time = moment(result[0], 'YYYY-MM-DD HH:mm:ss').tz('America/New_York')
      var ms = moment(now,"DD/MM/YYYY HH:mm:ss").diff(moment(time,"DD/MM/YYYY HH:mm:ss"))
      var d = moment.duration(ms)
      var days = Math.floor(d.asDays())
      var s = `${days === 1 ? '1 day, ' : days > 1 ? days + ' days, ' : ''}${Math.floor(d.asHours() - 24 * days) + moment.utc(ms).format(":mm:ss")}`

      resolve({
        unix: time.unix(),
        time: time.toString(),
        id: time.format('YYYY-MM-DD h:mm:ss A'),
        detail: result[1].trim().replace(/(\r\n|\n|\r)/gm, ""),
        uptime: s
      })
    })
  })
}

// Keep track of uptime
new CronJob({
  cronTime: '* * * * * *',
  onTick: () => {
    r.connect({db: 'brewery'}).then(conn => {
      uptime().then(result => {
        r.table('reboots').insert(result, {conflict: 'replace'}).run(conn).finally(results => {
          conn.close()
        })
      })
    })
  },
  runOnInit: true,
  start: true
})