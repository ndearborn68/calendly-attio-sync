/**
 * Simple structured logger
 * Outputs JSON for easy parsing in production
 */

/**
 * Log a message with optional context
 * @param {'info' | 'warn' | 'error'} level - Log level
 * @param {string} message - Log message
 * @param {object} context - Optional additional context
 */
function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context
  };

  const output = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    default:
      console.log(output);
  }
}

module.exports = { log };
