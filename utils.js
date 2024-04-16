const crypto = require('crypto'); // Node.js native module for cryptographic functionality

/**
 * Generates a random state value primarily used for CSRF protection in OAuth2 processes.
 * Utilizes the crypto module for cryptographically secure random value generation.
 * 
 * @param {number} [length=16] - The desired byte length of the state before being converted to a hex string. 
 *                               Default is 16 bytes which results in a 32-character hexadecimal string.
 * 
 * @returns {string} A random state value as a hexadecimal string.
 */
exports.generateRandomStateValue = function(length = 16) {
    // Generate random bytes and convert them to a hexadecimal string
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generates a random code verifier for the PKCE extension in OAuth2 processes.
 * The generated verifier is cryptographically random.
 * 
 * @param {number} [length=64] - The desired character length of the code verifier after conversion from hex.
 *                               Note: The final string might be shorter if the byte length doesn't match the 
 *                               desired character length.
 * 
 * @returns {string} A random code verifier as a hexadecimal string.
 */
exports.generateCodeVerifier = function(length = 64) {
    // Generate a random byte sequence, convert to hex and trim or pad to the desired length
    return crypto.randomBytes(length).toString('hex').slice(0, length);
};

/**
 * Generates a code challenge based on the provided verifier, as per the PKCE extension for OAuth2.
 * The challenge is produced by hashing the verifier with SHA-256, and then encoding the hash in URL-safe Base64.
 * 
 * @param {string} verifier - The code verifier from which the challenge is derived.
 * 
 * @returns {string} The corresponding code challenge, URL-safe Base64-encoded.
 */
exports.generateCodeChallenge = function(verifier) {
    // Hash the verifier using SHA-256
    const hashed = crypto.createHash('sha256').update(verifier).digest('base64');

    // Convert the Base64 hash to a URL-safe format by replacing certain characters
    return hashed
        .replace(/\+/g, '-') // '+' becomes '-'
        .replace(/\//g, '_') // '/' becomes '_'
        .replace(/=/g, '');  // Remove any padding '=' characters
};
