const crypto = require('crypto');

/**
 * Generates a random state value.
 * @param {number} [length=16] - The desired length of the state.
 * @returns {string} A random state value.
 */
exports.generateRandomStateValue = function(length = 16) {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generates a random code verifier.
 * @param {number} [length=64] - The desired length of the code verifier.
 * @returns {string} A random code verifier.
 */
exports.generateCodeVerifier = function(length = 64) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Generates a code challenge based on the provided verifier.
 * @param {string} verifier - The code verifier.
 * @returns {string} The corresponding code challenge.
 */
exports.generateCodeChallenge = function(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
};
