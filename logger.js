const winston = require('winston');
const config = require('./config');

const logger = winston.createLogger({
	level: config.NODE_ENV === "production" ? config.INFO_LOG_LEVEL : config.DEBUG_LOG_LEVEL,
	format: winston.format.combine(winston.format.timestamp({
		format: 'YYYY-MM-DD HH:mm:ss'
	}), winston.format.json()),
	defaultMeta: { service: `${config.SERVICE_NAME}` },
	transports: [
		new winston.transports.File({ filename: config.ERROR_LOG_PATH, level: 'error' }),
		new winston.transports.File({ filename: config.COMBINED_LOG_PATH })
	]
});

// If we're not in production, log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest })`
if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.simple(),
	}));
}

module.exports = logger;
