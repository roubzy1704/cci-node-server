require('dotenv').config();
const express = require('express');
const axios = require('axios');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const session = require('express-session');
const redis = require('redis');
const RedisStore = require("connect-redis").default;

const app = express();

app.use(helmet()); // Apply default Helmet headers
app.use(cors());

// Initialize Redis client and session middleware
const redisClient = redis.createClient({
	host: 'localhost',
	port: 6379,
});
(async () => {
	await redisClient.connect();
})();

console.log("Connecting to the Redis Server");

redisClient.on("ready", () => {
	console.log("Connected!");
});

redisClient.on("error", (err) => {
	console.error("Error in the Connection", err);
});

app.use(session({
	store: new RedisStore({ client: redisClient }),
	secret: process.env.CLIENT_SECRET,
	resave: false,
	saveUninitialized: false,
	cookie: {
		secure: process.env.NODE_ENV === "production" ? true : false, // Ensure HTTPS in production
		httpOnly: process.env.NODE_ENV === "production" ? true : false, // Ensure HTTPS in production
		maxAge: 1000 * 60 * 60 * 24 // 1 day
	}
}));

function generateRandomStateValue(length = 16) {
	return crypto.randomBytes(length).toString('hex');
}

function generateCodeVerifier(length = 64) {
	return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function generateCodeChallenge(verifier) {
	return crypto.createHash('sha256').update(verifier).digest('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

app.get('/auth', (req, res) => {
	const state = generateRandomStateValue();
	const codeVerifier = generateCodeVerifier();
	const codeChallenge = generateCodeChallenge(codeVerifier);

	req.session.oauthState = state;
	req.session.codeVerifier = codeVerifier;

	const authorizationUrl = `${process.env.OAUTH_STEP_ONE_GET_ENDPOINT}?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=${process.env.SCOPE}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
	res.redirect(authorizationUrl);
});

app.get('/callback', async (req, res) => {
	const returnedState = req.query.state;

	// Validate state value
	if (req.session.oauthState !== returnedState) {
		return res.status(400).send('State value does not match. Possible CSRF attack.');
	}

	try {
		const response = await axios.post(process.env.OAUTH_STEP_TWO_POST_ENDPOINT, {
			grant_type: 'authorization_code',
			redirect_uri: process.env.REDIRECT_URI,
			client_id: process.env.CLIENT_ID,
			code: req.query.code,
			code_verifier: req.session.codeVerifier
		}, {
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});

		console.log("Response from the API", response.data);

		// Store the token securely in the session
		req.session.tokenData = response.data;

		// Clear the OAuth session values to maintain session hygiene
		delete req.session.oauthState;
		delete req.session.codeVerifier;

		res.send('Token obtained and stored securely!');
	} catch (error) {
		console.error("Error details:", error.response?.data || error.message);
		res.status(500).send("Error obtaining token.");
	}
});

// Sample endpoint to retrieve stored token data (for testing purposes)
app.get('/gettoken', (req, res) => {
	res.json(req.session.tokenData || {});
});

// Logout Endpoint
app.get('/logout', (req, res) => {
	req.session.destroy(err => {
		if (err) {
			console.error("Error during session destruction:", err);
			res.status(500).send("Error during logout.");
		} else {
			res.send('Logged out successfully!');
		}
	});
});

app.listen(process.env.PORT, () => {
	console.log(`Server is running on http://localhost:${process.env.PORT}`);
});
