const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

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

// Transport for error logs
const errorTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxFiles: '30d',
    maxSize: '20m',
    format: logFormat
});

// Transport for combined logs
const combinedTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: logFormat
});

// Transport for security logs
const securityTransport = new DailyRotateFile({
    filename: path.join(__dirname, '../logs/security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'warn',
    maxFiles: '90d',
    maxSize: '20m',
    format: logFormat
});

// Create logger instance
const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: logFormat,
    transports: [
        errorTransport,
        combinedTransport,
        securityTransport
    ],
    exitOnError: false
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        )
    }));
}

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