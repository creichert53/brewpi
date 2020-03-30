const { createLogger, format, transports } = require('winston')
const chalk = require('chalk')

const formatMessage = message => {
  try {
    if (typeof message === 'string')
      message = JSON.parse(message)
    return JSON.stringify(message, null, 2)
  } catch (error) {
    return message
  }
}

const customLevels = {
  CRITICAL: 0,
  ERROR: 1,
  WARN: 2,
  TRACE: 3,
  SUCCESS: 4,
  INFO: 5,
}

const color = (level, message) => {
  switch (level) {
    case 'INFO':
      return chalk.cyan(message)
    case 'TRACE':
      return chalk.magenta(message)
    case 'WARN':
      return chalk.yellow(message)
    case 'SUCCESS':
      return chalk.green(message)
    case 'ERROR':
      return chalk.red(message)
    case 'CRITICAL':
      return chalk.white.bgRed(message)
    default:
      return chalk.white(message)
  }
}

class CustomLogger {
  constructor() {
    this.logger = createLogger({
      level: 'INFO',
      levels: customLevels,
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.printf(info => {
          return `${info.timestamp} ${color(info.level, info.level)}: ${color(info.level, formatMessage(info.message || info))}`
        })
      ),
      transports: [new transports.Console()]
    })
  }

  log(level, message) {
    this.logger.log(level, message)
  }
  info(message) {
    this.logger.log('INFO', message)
  }
  trace(message) {
    this.logger.log('TRACE', message)
  }
  warn(message) {
    this.logger.log('WARN', message)
  }
  success(message) {
    this.logger.log('SUCCESS', message)
  }
  error(message) {
    this.logger.log('ERROR', message)
  }
  critical(message) {
    this.logger.log('CRITICAL', message)
  }
}

module.exports = new CustomLogger()