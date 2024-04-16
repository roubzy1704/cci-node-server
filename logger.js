const winston = require('winston');
const config = require('./config');

// Create a logger instance using the Winston library.
const logger = winston.createLogger({
	// Set the log level based on the application's environment.
	// In production, we'll only log messages of level 'info' or higher.
	// In other environments (like development), we'll log debug messages and above.
	level: config.NODE_ENV === "production" ? config.INFO_LOG_LEVEL : config.DEBUG_LOG_LEVEL,
	
	// Use a combination of timestamp and JSON format for structured logs.
	format: winston.format.combine(
		winston.format.timestamp({
			format: 'YYYY-MM-DD HH:mm:ss'
		}),
		winston.format.json()
	),
	
	// Add metadata to each log entry, in this case, the service name.
	defaultMeta: { service: `${config.SERVICE_NAME}` },
	
	// Set up transports (destinations) for the logs.
	// - Errors will be logged to a dedicated error file.
	// - All logs (including errors) will be logged to a combined file.
	transports: [
		new winston.transports.File({ filename: config.ERROR_LOG_PATH, level: 'error' }),
		new winston.transports.File({ filename: config.COMBINED_LOG_PATH })
	]
});

// If the application is running in a non-production environment (like development),
// also log messages to the console in a simple format for easy readability.
if (process.env.NODE_ENV !== 'production') {
	logger.add(new winston.transports.Console({
		format: winston.format.simple(),
	}));
}

// Export the logger for use in other parts of the application.
module.exports = logger;
