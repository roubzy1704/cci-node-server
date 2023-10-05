// Load environment variables from the .env file
require('dotenv').config();

// External module imports
const express = require('express');
const axios = require('axios');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const redis = require('redis');
const RedisStore = require("connect-redis").default;
const rateLimit = require("express-rate-limit");

// Internal module imports
const config = require('./config');
const { generateRandomStateValue, generateCodeVerifier, generateCodeChallenge } = require('./utils');
const { handleError, handle404 } = require('./errorHandlers');

const app = express();
app.set('trust proxy', 1);  // trust the first proxy

// Middleware to set various security headers
app.use(helmet());

// Middleware to enable Cross-Origin Resource Sharing
app.use(cors());

// Rate limiting middleware to prevent abuse
const limiter = rateLimit({
    windowMs: config.RATE_LIMIT_MINUTES * 60 * 1000, // Limit requests to 100 every 15 minutes
    max: config.RATE_LIMIT_MAX_REQUESTS 
});
app.use(limiter);

// Set up the Redis client for session storage
const redisClient = redis.createClient({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
});
console.log("Attempting to connect to Redis...");
(async () => {
	await redisClient.connect();
})();

// Log and exit if there's an error connecting to Redis
redisClient.on("error", (err) => {
    console.error("Error in the Redis Connection", err);
    process.exit(1);
});

// Session middleware setup
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: config.CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: config.NODE_ENV === "production",
        httpOnly: config.NODE_ENV === "production",
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 // Set cookie's max age to 1 day
    }
}));

// OAuth2 Authorization route
app.get('/auth', (req, res) => {
    const state = generateRandomStateValue();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const authorizationUrl = `${config.OAUTH_STEP_ONE_GET_ENDPOINT}?response_type=code&client_id=${config.CLIENT_ID}&redirect_uri=${config.REDIRECT_URI}&scope=${config.SCOPE}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    res.redirect(authorizationUrl);
});

// OAuth2 Callback route
app.get('/callback', async (req, res, next) => {
    const returnedState = req.query.state;

    if (req.session.oauthState !== returnedState) {
        return res.status(400).send('State value does not match. Possible CSRF attack.');
    }

    try {
        const response = await axios.post(config.OAUTH_STEP_TWO_POST_ENDPOINT, {
            grant_type: 'authorization_code',
            redirect_uri: config.REDIRECT_URI,
            client_id: config.CLIENT_ID,
            code: req.query.code,
            code_verifier: req.session.codeVerifier
        }, {
            headers: {
            	'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        req.session.tokenData = response.data;
        delete req.session.oauthState;
        delete req.session.codeVerifier;

        res.send('Token obtained and stored securely!');
    } catch (error) {
        console.error("Error details:", error.response?.data || error.message);
        next(new Error("Error obtaining token."));
    }
});

// Route to retrieve stored token data for testing purposes
app.get('/gettoken', (req, res) => {
    res.json(req.session.tokenData || {});
});

// Route to handle user logout
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error during session destruction:", err);
            return res.status(500).send("Error during logout.");
        }
        res.send('Logged out successfully!');
    });
});

// Error handling middlewares
app.use(handle404);
app.use(handleError);

// Start the server once Redis is ready
function startServer() {
    app.listen(config.SERVER_PORT, () => {
        console.log(`Server is running on http://localhost:${config.SERVER_PORT}`);
    });
}
redisClient.on("ready", () => {
	startServer();
	console.log("Connected!");
});