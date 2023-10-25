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

// iDRIVE(AWS API) module imports
const AWS = require('aws-sdk');
const multer = require('multer');
const storage = multer.memoryStorage(); // Store the file as a buffer in memory
const upload = multer({ storage: storage });

// Configure AWS SDK
AWS.config.update({
	accessKeyId: config.IDRIVE_ACCESS_KEY_ID,
	secretAccessKey: config.IDRIVE_SECRET_ACCESS_KEY,
	region: config.IDRIVE_S3_REGION
});
const customEndpoint = config.IDRIVE_S3_ENDPOINT;
const s3 = new AWS.S3({
	endpoint: customEndpoint,
	s3ForcePathStyle: true,
});

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

// Route to update ItemFulfillment record
app.get('/api/updateItemFulfillmentRecord', async (req, res, next) => {
	logger.info(`/api/getItemFulfillmentRecord: ${config.SERVICE_NAME}`);
	try {
		const tokenData = req.query.data;
		const id = req.query.id;
		const response = await axios.patch(`${config.CCI_NETSUITE_REST_ROOT_URI}/itemFulfillment/${id}`,
		{
			
		}, {
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

// Route to handle iDRIVE bucket upload
app.post('/api/uploadToS3', upload.array('files'), async (req, res, next) => {
	try {
		const files = req.files;

		if (!files || files.length !== 2) {
			return res.status(400).send('Both signature and image files are required.');
		}

		// Array to store the URLs of the uploaded files
		const uploadedFileUrls = [];

		await Promise.all(files.map(async (file) => {
			const fullFileName = file.originalname.includes('picture') ? `${config.IDRIVE_S3_PICTURES_FOLDER}/${file.originalname}` : `${config.IDRIVE_S3_SIGNATURES_FOLDER}/${file.originalname}`;
			const uploadParams = {
				Bucket: `${config.IDRIVE_S3_BUCKET_NAME}`,
				Key: fullFileName,
				Body: file.buffer,
				ContentType: file.mimetype,
				ACL: `${config.IDRIVE_S3_ACL}`
			};

			const result = await s3.upload(uploadParams).promise();
			let resultPublicLocation = result.Location.substring(result.Location.indexOf('m') + 1); // 'm' is last letter of bucket endpoint
			resultPublicLocation=`${config.IDRIVE_S3_PUBLIC_ENDPOINT}${resultPublicLocation}`;
			uploadedFileUrls.push(resultPublicLocation);  // Capture the public file URL
		}));

		res.json({
			message: 'Images successfully uploaded.',
			urls: uploadedFileUrls  // Return the URLs of the uploaded files
		});
	} catch (error) {
		next(error);
	}
});

// Error handling middlewares
app.use(handle404);
app.use(handleError);

const serverHost = config.SERVER_HOST || 'http://localhost';
const port = config.SERVER_PORT || 3000;

app.listen(port, () => {
	logger.info(`Server is running on ${serverHost}:${port}`);
});
