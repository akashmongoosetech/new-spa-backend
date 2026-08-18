/**
 * Wraps async route handlers so rejected promises flow to the global error
 * middleware instead of crashing the process.
 */
export default function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}