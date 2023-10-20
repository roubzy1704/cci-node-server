// Load environment variables from the .env file
require('dotenv').config();

// External module imports
const express = require('express');
const axios = require('axios');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require("express-rate-limit");
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

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
	windowMs: config.RATE_LIMIT_MINUTES * 60 * 1000,
	max: config.RATE_LIMIT_MAX_REQUESTS
});
app.use(limiter);

// OAuth2 Authorization route
app.get('/auth', async (req, res, next) => {
	logger.info(`Authenticating: ${config.SERVICE_NAME}`);
	const state = generateRandomStateValue();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);
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
		const decodedToken = jwt.decode(tokenData);
		// Extract user ID from the verified token
		const userId = decodedToken.sub.substring(decodedToken.sub.indexOf(";") + 1);
		const response = await axios.post(`${config.CCI_NETSUITE_SUITEQL_ROOT_URI}/suiteql?limit=100`, {
			"q": `SELECT * FROM \"transaction\" WHERE NOT status=(SELECT id FROM TransactionStatus WHERE id='C' AND name='Shipped' AND fullname='Item Fulfillment : Shipped') 
					AND custbody8 LIKE '%${userId}%'`
		}, {
			headers: {
				'Authorization': `Bearer ${tokenData}`,
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
		const id = req.query.id;
		const response = await axios.get(`${config.CCI_NETSUITE_REST_ROOT_URI}/itemFulfillment/${id}`, {
			headers: {
				'Authorization': `Bearer ${tokenData}`
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
	res.clearCookie('oauth_state', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.clearCookie('oauth_code_verifier', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.redirect(`${config.CCI_APP_HOME}/`);
});

// Error handling middlewares
app.use(handle404);
app.use(handleError);

const serverHost = config.SERVER_HOST || 'http://localhost';
const port = config.SERVER_PORT || 3000;

app.listen(port, () => {
	logger.info(`Server is running on ${serverHost}:${port}`);
});
