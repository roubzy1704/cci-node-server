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
    console.error(err.message); // This will ideally be replaced with a proper logger, e.g., Winston.
    res.status(500).send('Internal Server Error');
};
