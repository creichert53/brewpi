require('../service/timeout')

setTimeoutGlobal(() => console.log('Do not call this.'), 5000)

clearAllTimeouts()