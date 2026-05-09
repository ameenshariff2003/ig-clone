const AppError = require('../utils/AppError')

// ─── Translators for known library errors ─────────────────────────────────────

/** Mongoose duplicate key (e.g. unique email/mobile already exists) */
const handleDuplicateKeyError = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || 'field'
  return new AppError(`That ${field} is already in use by another account.`, 409)
}

/** Mongoose schema validation failure (required field missing, maxlength, etc.) */
const handleValidationError = (err) => {
  const messages = Object.values(err.errors).map(e => e.message).join(' ')
  return new AppError(`Validation failed: ${messages}`, 400)
}

/** Mongoose bad ObjectId (e.g. someone passes "abc" as a Mongo _id) */
const handleCastError = (err) => {
  return new AppError(`Invalid value for field '${err.path}'.`, 400)
}

/** JWT has been tampered with */
const handleJwtInvalidError = () =>
  new AppError('Session token is invalid. Please sign in again.', 401)

/** JWT has expired */
const handleJwtExpiredError = () =>
  new AppError('Your session has expired. Please sign in again.', 401)

// ─── Response senders ──────────────────────────────────────────────────────────

const sendDevelopmentError = (err, res) => {
  // Full detail in dev — stack trace, raw error, everything
  res.status(err.statusCode || 500).json({
    status:  err.statusCode < 500 ? 'fail' : 'error',
    msg:     err.message,
    stack:   err.stack,
    error:   err,
  })
}

const sendProductionError = (err, res) => {
  if (err.operational) {
    // Safe to expose — we wrote this message ourselves
    res.status(err.statusCode).json({ msg: err.message })
  } else {
    // Unknown bug: log it server-side, send nothing useful to the client
    console.error('[UNHANDLED ERROR]', err)
    res.status(500).json({ msg: 'An unexpected error occurred. Please try again.',err })
  }
}

// ─── Main error middleware ─────────────────────────────────────────────────────
// Must have exactly 4 params so Express recognises it as an error handler.

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500

  if (process.env.NODE_ENV === 'development') {
    return sendDevelopmentError(err, res)
  }

  // In production, translate known library errors into clean AppErrors
  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err)
  error.message = err.message     // message isn't enumerable on Error — copy manually

  if (error.code === 11000)                  error = handleDuplicateKeyError(error)
  if (error.name === 'ValidationError')      error = handleValidationError(error)
  if (error.name === 'CastError')            error = handleCastError(error)
  if (error.name === 'JsonWebTokenError')    error = handleJwtInvalidError()
  if (error.name === 'TokenExpiredError')    error = handleJwtExpiredError()

  sendProductionError(error, res)
}

module.exports = errorHandler