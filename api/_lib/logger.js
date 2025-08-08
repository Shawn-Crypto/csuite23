// Simple logging utility for serverless functions
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const currentLogLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

/**
 * Log function with structured output
 * @param {string} level - Log level (error, warn, info, debug)
 * @param {string} message - Log message
 * @param {object} meta - Additional metadata
 */
const log = (level, message, meta = {}) => {
  const numericLevel = LOG_LEVELS[level.toUpperCase()];
  
  if (numericLevel > currentLogLevel) {
    return;
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...meta,
  };

  console.log(JSON.stringify(logEntry));
};

const logger = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};

module.exports = logger;
