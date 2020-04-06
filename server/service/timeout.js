const logger = require('./logger')

let globalObject
if (typeof window === 'undefined') {
  globalObject = global
} else {
  globalObject = window
}

let allTimeoutIds = []
const originalTimeout = setTimeout
// Use a function instead of () => to ensure this can be overridden.
globalObject.setTimeoutGlobal = function(callback, timeInMS) {
  const timeoutId = originalTimeout(callback, timeInMS)
  allTimeoutIds.push(timeoutId)
  return timeoutId
}

const originalClearTimeout = clearTimeout
globalObject.clearTimeoutGlobal = function(timeoutId) {
  allTimeoutIds = allTimeoutIds.filter((id) => id !== timeoutId)
  originalClearTimeout(timeoutId)
}

globalObject.clearAllTimeouts = function() {
  logger.info('Clearing all global timers.')
  for (var i = allTimeoutIds.length; i > 0; i--) {
    originalClearTimeout(allTimeoutIds[i - 1])
  }
}