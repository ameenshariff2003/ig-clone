/**
 * Wraps an async route handler so any thrown error is forwarded
 * to Express's next(err) automatically — no try/catch needed.
 *
 * Usage:  router.post('/login', asyncHandler(auth.login))
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = asyncHandler