const logger = require('./logger');

/**
 * Middleware to handle 404 - Not Found errors.
 *
 * This middleware is typically placed at the end of the middleware chain.
 * It's invoked when no route handlers or middlewares respond to a request, 
 * which is typically interpreted as a 404 Not Found error.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object. Provides methods to send responses.
 * @param {Function} next - The Express next middleware function. In this context, it's used 
 *                          to potentially pass control to the next middleware, but is 
 *                          typically unused in a 404 handler.
 */
exports.handle404 = (req, res, next) => {
    res.status(404).send('Not Found');
};

/**
 * Middleware to handle all other errors.
 *
 * This is a generic error-handling middleware. It logs the error details 
 * and responds with a generic message to the client. The specific nature 
 * of the error isn't revealed to the client to prevent any potential 
 * information leakage or security issues.
 *
 * Note: The function signature with four arguments (err, req, res, next) 
 * is significant as it tells Express this is an error-handling middleware.
 *
 * @param {Error} err - The error object. Contains information about the error.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object. Provides methods to send responses.
 * @param {Function} next - The Express next middleware function. Can be used to pass control 
 *                          to the next error-handling middleware, if there are any.
 */
exports.handleError = (err, req, res, next) => {
    // Log the error details using the logger utility
    logger.error("Error details: ", { error: err.message });
    
    // Send a generic error message to the client
    res.status(500).send('Internal Server Error');
};
