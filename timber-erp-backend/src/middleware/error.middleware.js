function errorHandler(err, req, res, next) {
  console.error("API Error:", {
    message: err.message,
    requestId: req.requestId,
  });

  const statusCode =
    Number.isInteger(err.statusCode) &&
    err.statusCode >= 400 &&
    err.statusCode < 600
      ? err.statusCode
      : 500;

  const response = {
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message,
    requestId: req.requestId || null,
  };

  if (process.env.NODE_ENV === "development") {
    response.debug = {
      message: err.message,
      stack: err.stack,
    };
  }

  res.status(statusCode).json(response);
}

module.exports = errorHandler;