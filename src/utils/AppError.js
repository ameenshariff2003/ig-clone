/**
 * Operational errors we throw intentionally (4xx, known 5xx).
 * Non-operational errors (bugs, DB crashes) are handled separately.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.statusCode  = statusCode
    this.operational = true          // flag: we created this deliberately
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = AppError