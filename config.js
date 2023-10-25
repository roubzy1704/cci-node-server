const Joi = require('joi');

// Validate environment variables using Joi
const schema = Joi.object({
	CLIENT_ID: Joi.string().required(),
	CLIENT_SECRET: Joi.string().required(),
	REDIRECT_URI: Joi.string().required(),
	OAUTH_STEP_ONE_GET_ENDPOINT: Joi.string().required(),
	OAUTH_STEP_TWO_POST_ENDPOINT: Joi.string().required(),
	SCOPE: Joi.string().required(),
	SERVER_HOST: Joi.string().required(),
	SERVER_PORT: Joi.number().required(),
	REDIS_HOST: Joi.string().required(),
	REDIS_PORT: Joi.number().required(),
	REDIS_EXPIRATION_TIME: Joi.number().required(),
	RATE_LIMIT_MINUTES: Joi.number().required(),
	RATE_LIMIT_MAX_REQUESTS: Joi.number().required(),
	NODE_ENV: Joi.string().valid('production', 'development').default('development'),
	INFO_LOG_LEVEL: Joi.string().required(),
	DEBUG_LOG_LEVEL: Joi.string().required(),
	ERROR_LOG_LEVEL: Joi.string().required(),
	SERVICE_NAME: Joi.string().required(),
	ERROR_LOG_PATH: Joi.string().required(),
	COMBINED_LOG_PATH: Joi.string().required(),
	IDRIVE_ACCESS_KEY_ID: Joi.string().required(),
	IDRIVE_SECRET_ACCESS_KEY: Joi.string().required(),
	IDRIVE_S3_REGION: Joi.string().required(),
	IDRIVE_S3_ACL: Joi.string().required(),
	IDRIVE_S3_ENDPOINT: Joi.string().required(),
	IDRIVE_S3_BUCKET_NAME: Joi.string().required(),
	IDRIVE_S3_PICTURES_FOLDER: Joi.string().required(),
	IDRIVE_S3_SIGNATURES_FOLDER: Joi.string().required(),
	IDRIVE_S3_PUBLIC_ENDPOINT: Joi.string().required()
}).unknown(true);

const { error, value: validatedEnvConfig } = schema.validate(process.env);

if (error) {
	throw new Error(`Config validation error: ${error.message}`);
}

// Export the validated environment variables
module.exports = validatedEnvConfig;