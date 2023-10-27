// Load environment variables from the .env file
require('dotenv').config();

// External module imports
const express = require('express');
const axios = require('axios'); // For making HTTP requests
const helmet = require('helmet'); // For security headers
const cors = require('cors'); // For handling cross-origin requests
const rateLimit = require("express-rate-limit"); // For rate-limiting to prevent abuse
const cookieParser = require('cookie-parser'); // For parsing cookies from request headers
const jwt = require('jsonwebtoken'); // For decoding JWT tokens

// Internal module imports
// Logger for application-specific logging
const logger = require('./logger');
// Configuration settings for the application
const config = require('./config');
// Utility functions
const { generateRandomStateValue, generateCodeVerifier, generateCodeChallenge } = require('./utils');
// Custom error handlers
const { handleError, handle404 } = require('./errorHandlers');

// AWS module imports for handling file uploads to S3
const AWS = require('aws-sdk');
const multer = require('multer');
const storage = multer.memoryStorage(); // Store uploaded files as buffers in memory
const upload = multer({ storage: storage });

// Configure AWS SDK with access credentials and region
AWS.config.update({
	accessKeyId: config.IDRIVE_ACCESS_KEY_ID,
	secretAccessKey: config.IDRIVE_SECRET_ACCESS_KEY,
	region: config.IDRIVE_S3_REGION
});
const customEndpoint = config.IDRIVE_S3_ENDPOINT;
const s3 = new AWS.S3({
	endpoint: customEndpoint,
	s3ForcePathStyle: true,  // Forces path style URLs
});

// Initialize Express application
const app = express();

// Middleware configurations
app.use(express.json());  // Parse JSON request bodies
app.use(express.urlencoded({ extended: true }));  // Parse URL-encoded request bodies
app.set('trust proxy', 1);  // trust the first proxy, e.g. if behind a load balancer

// Parse cookie headers and populate `req.cookies`
app.use(cookieParser());
// Set various security headers
app.use(helmet());
// Enable Cross-Origin Resource Sharing for the specified origin
app.use(cors({
	origin: config.CCI_APP_HOME,
	credentials: true
}));
// Set up rate limiting to prevent abuse
const limiter = rateLimit({
	windowMs: config.RATE_LIMIT_MINUTES * 60 * 1000,  // Window duration
	max: config.RATE_LIMIT_MAX_REQUESTS  // Max number of requests in the window duration
});
app.use(limiter);

// Route to initiate the OAuth2 authorization process
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

// Route to handle callback from the OAuth2 authorization server
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

// Endpoint to fetch ItemFulfillment data using SuiteQL
app.get('/api/getItemFulfillmentDataSuiteQL', async (req, res, next) => {
	logger.info(`/api/getItemFulfillmentDataSuiteQL: ${config.SERVICE_NAME}`);
	try {
		const tokenData = req.query.data;
		const decodedToken = jwt.decode(tokenData);
		// Extract user ID from the verified token
		const userId = decodedToken.sub.substring(decodedToken.sub.indexOf(";") + 1);
		const response = await axios.post(`${config.CCI_NETSUITE_SUITEQL_ROOT_URI}/suiteql?limit=100`, {
			"q": `SELECT * FROM \"transaction\" WHERE NOT status=(SELECT id FROM TransactionStatus WHERE id='C' AND name='Shipped' AND fullname='Item Fulfillment : Shipped') 
			      AND custbody_assigned_user LIKE '%${userId}%'`
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

// Endpoint to retrieve a specific ItemFulfillment record
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

// Endpoint to update a specific ItemFulfillment record
app.post('/api/updateItemFulfillmentRecord', async (req, res, next) => {
	logger.info(`/api/updateItemFulfillmentRecord: ${config.SERVICE_NAME}`);
	try {
		const tokenData = req.body.data;
		const id = req.body.id;
		const capturedImage = req.body.capturedImage;
		const signatureImage = req.body.signatureImage;

		// Check if required data is missing
		if (!tokenData || !id || !capturedImage || !signatureImage) {
			return res.status(400).json({ error: 'Missing required data.' });
		}

		// Construct the payload for the update
		const payload = {
			custbody_delivery_signature: capturedImage,
			custbody_delivery_picture: signatureImage,
			status: {
				id: 'Shipped',
				refName: 'Shipped'
			},
			shipStatus: {
				id: 'C',
				refName: 'Shipped'
			},
			custbody_prevent_auto_email: false
		};

		// Make the PATCH request to update the record
		const response = await axios.patch(
			`${config.CCI_NETSUITE_REST_ROOT_URI}/itemFulfillment/${id}`,
			payload,
			{
				headers: {
					Authorization: `Bearer ${tokenData}`,
				},
			}
		);

		if (response.status === 204) {
			res.json({ message: 'ItemFulfillment record updated successfully.' });
		} else {
			// Handle other status codes
			res.status(response.status).json({ error: 'Failed to update ItemFulfillment record.' });
		}
	} catch (error) {
		// Log the error and pass it to the error handler
		logger.error(`Error updating ItemFulfillment record: ${error}`);
		next(error);
	}
});


// Logout route - clears relevant cookies and redirects to home
app.get('/logout', async (req, res, next) => {
	logger.info(`/logout: ${config.SERVICE_NAME}`);
	res.clearCookie('oauth_state', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.clearCookie('oauth_code_verifier', { domain: 'loca.lt', path: '/', httpOnly: true, secure: true, sameSite: 'none' });
	res.redirect(`${config.CCI_APP_HOME}/`);
});

// Endpoint to handle uploads to the iDRIVE S3 bucket
app.post('/api/uploadToS3', upload.array('files'), async (req, res, next) => {
	logger.info(`/api/uploadToS3: ${config.SERVICE_NAME}`);
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
			resultPublicLocation = `${config.IDRIVE_S3_PUBLIC_ENDPOINT}${resultPublicLocation}`;
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

// Start the server on the specified port
const serverHost = config.SERVER_HOST || 'http://localhost';
const port = config.SERVER_PORT || 3000;
app.listen(port, () => {
	logger.info(`Server is running on ${serverHost}:${port}`);
});
