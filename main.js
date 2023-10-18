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
const cookieParser = require('cookie-parser');

// Internal module imports
const logger = require('./logger');
const config = require('./config');
const { generateRandomStateValue, generateCodeVerifier, generateCodeChallenge } = require('./utils');
const { handleError, handle404 } = require('./errorHandlers');

const app = express();
app.set('trust proxy', 1);  // trust the first proxy

// Use the cookie-parser middleware
app.use(cookieParser());

// Middleware to set various security headers
app.use(helmet());

// Middleware to enable Cross-Origin Resource Sharing
app.use(cors({
	origin: config.CCI_APP_HOME,
	credentials: true
}));

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
logger.info("Attempting to connect to Redis...");
(async () => {
	try {
		await redisClient.connect();
	} catch (err) {
		logger.error("Failed to connect to Redis.", { error: err.message });
		// Handle error as per application requirement
	}
})();

// Log and exit if there's an error connecting to Redis
let retries = 5;
redisClient.on("error", (err) => {
	logger.error("Error connecting to Redis.", { error: err.message });
	if (retries > 0) {
		retries--;
		setTimeout(() => {
			redisClient.connect();
		}, 5000); // Retry after 5 seconds
	} else {
		logger.error("Failed to connect to Redis after multiple attempts.");
	}
});

// Session middleware setup
app.use(session({
	store: new RedisStore({ client: redisClient }),
	secret: config.CLIENT_SECRET,
	name: 'cci-app-session-id',
	resave: true,
	saveUninitialized: false,
	cookie: {
		secure: true,
		httpOnly: true,
		sameSite: 'none',
		maxAge: 1000 * 60 * 60 * 24 // Set cookie's max age to 1 day
	}
}));

// OAuth2 Authorization route
app.get('/auth', async (req, res, next) => {
	logger.info(`Authenticating: ${config.SERVICE_NAME}`);
	const state = generateRandomStateValue();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);
	// Set these values as HTTP-only cookies
	res.cookie('oauth_state', state, { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.cookie('oauth_code_verifier', codeVerifier, { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	const authorizationUrl = `${config.OAUTH_STEP_ONE_GET_ENDPOINT}?response_type=code&client_id=${config.CLIENT_ID}&redirect_uri=${config.REDIRECT_URI}&scope=${config.SCOPE}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
	res.redirect(authorizationUrl);
});

// OAuth2 Callback route
app.get('/callback', async (req, res, next) => {
	logger.info(`Callback: ${config.SERVICE_NAME}`);
	const { code, state: returnedState } = req.query;
	const storedState = req.cookies.oauth_state;
	const codeVerifier = req.cookies.oauth_code_verifier;
	if (returnedState !== storedState) {
		return res.status(400).send('State value does not match. Possible CSRF attack.');
	}
	try {
		const response = await axios.post(config.OAUTH_STEP_TWO_POST_ENDPOINT, {
			grant_type: 'authorization_code',
			redirect_uri: config.REDIRECT_URI,
			client_id: config.CLIENT_ID,
			client_secret: config.CLIENT_SECRET,
			code: code,
			code_verifier: codeVerifier
		}, {
			headers: {
				'Content-Type': `${config.POST_HEADER_CONTENT_TYPE}`
			}
		});
		// Clear the cookies after usage
		res.clearCookie('oauth_state', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
		res.clearCookie('oauth_code_verifier', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
		res.redirect(`${config.CCI_APP_HOME}/dashboard?data=${encodeURIComponent(response.data.access_token)}`);
	} catch (error) {
		next(error);
	}
});

// Route to retrieve ItemFulfillment data by SuiteQL
app.get('/api/getItemFulfillmentDataSuiteQL', async (req, res, next) => {
	logger.info(`/api/getItemFulfillmentDataSuiteQL: ${config.SERVICE_NAME}`);
	try {
		const tokenData = req.query.data;
		const accessToken = tokenData;
		const response = await axios.post(`${config.CCI_NETSUITE_SUITEQL_ROOT_URI}/suiteql?limit=100`, {
			"q": "SELECT * FROM \"transaction\" WHERE custbody8 LIKE '%16543%'"
		}, {
			headers: {
				'Authorization': `Bearer ${accessToken}`,
				'Prefer': 'transient'
			}
		});
		res.json(response.data);
	} catch (error) {
		next(error);
	}
});

// Route to retrieve ItemFulfillment record
app.get('/api/getItemFulfillmentRecord', async (req, res, next) => {
	logger.info(`/api/getItemFulfillmentRecord: ${config.SERVICE_NAME}`);
	try {
		const tokenData = req.query.data;
		const accessToken = tokenData;
		const id = req.query.id;
		const response = await axios.get(`${config.CCI_NETSUITE_REST_ROOT_URI}/itemFulfillment/${id}`, {
			headers: {
				'Authorization': `Bearer ${accessToken}`
			}
		});
		res.json(response.data);
	} catch (error) {
		next(error);
	}
});


// Route to handle user logout
app.get('/logout', async (req, res, next) => {
	logger.info(`/logout: ${config.SERVICE_NAME}`);
	// Clear the cookies after usage
	res.clearCookie('oauth_state', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.clearCookie('oauth_code_verifier', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.redirect(`${config.CCI_APP_HOME}/`);
});

// Error handling middlewares
app.use(handle404);
app.use(handleError);

const serverHost = config.SERVER_HOST || 'http://localhost';
//server port
const port = config.SERVER_PORT || 3000;  // config.SERVER_PORT is undefined, then it defaults to 3000

// Start the server once Redis is ready
function startServer() {
	app.listen(port, () => {
		logger.info(`Server is running on ${serverHost}:${port}`);
	});
}
redisClient.on("ready", () => {
	startServer();
	logger.info("Connected!");
});