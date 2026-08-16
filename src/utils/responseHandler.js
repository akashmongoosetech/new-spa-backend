export function sendSuccess(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
}

export function sendError(res, message = 'Internal Server Error', statusCode = 500, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors
  });
}

// Logs the real error server-side but returns a generic message to the client
// so internal details (SQL errors, stack traces) are never leaked.
export function handleError(res, err, fallbackMessage = 'Internal server error') {
  console.error('Internal Server Error:', err?.stack || err?.message || err);
  return sendError(res, fallbackMessage, 500);
}
