const Joi = require('joi');

// Validate environment variables using Joi
const schema = Joi.object({
    CLIENT_ID: Joi.string().required(),
    CLIENT_SECRET: Joi.string().required(),
    REDIRECT_URI: Joi.string().required(),
    OAUTH_STEP_ONE_GET_ENDPOINT: Joi.string().required(),
    OAUTH_STEP_TWO_POST_ENDPOINT: Joi.string().required(),
    SCOPE: Joi.string().required(),
    SERVER_PORT: Joi.number().required(),
    REDIS_HOST: Joi.string().required(),    
    REDIS_PORT: Joi.number().required(),
    RATE_LIMIT_MINUTES: Joi.number().required(),
    RATE_LIMIT_MAX_REQUESTS: Joi.number().required(),    
    NODE_ENV: Joi.string().valid('production', 'development').default('development'),
}).unknown(true);

const { error, value: validatedEnvConfig } = schema.validate(process.env);

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

// Export the validated environment variables
module.exports = validatedEnvConfig;