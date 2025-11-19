const winston = require('winston');

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
        
        // Add metadata if present
        if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`;
        }
        
        // Add stack trace for errors
        if (stack) {
            log += `\n${stack}`;
        }
        
        return log;
    })
);

// Create logger instance - CONSOLE ONLY for Vercel
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        // Console transport for all environments
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
    exitOnError: false
});

// Security logging helper
logger.security = (action, details) => {
    logger.warn('SECURITY EVENT', {
        action,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Request logging helper
logger.logRequest = (req, level = 'info') => {
    logger.log(level, 'HTTP Request', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id || 'anonymous'
    });
};

// Error logging helper (sanitized)
logger.logError = (error, req = null) => {
    const errorLog = {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name
    };
    
    if (req) {
        errorLog.request = {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
            userId: req.user?.id
        };
    }
    
    logger.error('Application Error', errorLog);
};

module.exports = logger;