const logger = require('./logger');

/**
 * Handles 404 - Not Found errors.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The Express next middleware function.
 */
exports.handle404 = (req, res, next) => {
    res.status(404).send('Not Found');
};

/**
 * Handles all other errors.
 * @param {Error} err - The error object.
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 * @param {Function} next - The Express next middleware function.
 */
exports.handleError = (err, req, res, next) => {
    logger.error("Error details: ", { error: err.message });    
    res.status(500).send('Internal Server Error');
};
