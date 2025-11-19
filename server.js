require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const https = require('https');
const http = require('http');
const fs = require('fs');
const logger = require('./config/logger');
const path = require('path');

const app = express();

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    }
}));

// CORS - HTTPS first
app.use(cors({
    origin: ['https://localhost:3000', 'http://localhost:3000'], // HTTPS FIRST
    credentials: true
}));

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Specific login rate limiter - COUNT ALL ATTEMPTS (failed and successful)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Too many login attempts from this IP, please try again after 15 minutes'
    },
    skipSuccessfulRequests: false, // ← COUNT FAILED ATTEMPTS TOO
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        error: 'Too many auth requests from this IP, please try again after 15 minutes'
    },
    skipSuccessfulRequests: true,
});

const recipeCreationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        error: 'Too many recipes created, please try again later'
    }
});

const adminLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
        success: false,
        error: 'Too many admin requests, please try again later'
    }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', loginLimiter); // ← SPECIFIC LOGIN LIMITER
app.use('/api/auth/', authLimiter);
app.use('/api/recipes/create', recipeCreationLimiter);
app.use('/api/admin/', adminLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(hpp());

// Session configuration - CRITICAL FIX: Set secure to true for HTTPS
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600
    }),
    cookie: {
        secure: true, // ← CHANGED FROM false TO true (THIS FIXES "NOT SECURE")
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'strict'
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
    logger.logRequest(req);
    next();
});

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const recipeRoutes = require('./routes/recipeRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recipes', recipeRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.logError(err, req);
    
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message;
    
    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/recipebox')
    .then(() => {
        logger.info('MongoDB connected successfully');
        console.log('MongoDB connected');
    })
    .catch((error) => {
        logger.error('MongoDB connection error', { error: error.message });
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    });

// HTTPS/HTTP Server Setup
const PORT = process.env.PORT || 3000;
let server;

// Check if SSL certificates exist in ssl folder
const keyPath = './ssl/key.pem';
const certPath = './ssl/cert.pem';

if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const options = {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
    };
    server = https.createServer(options, app).listen(PORT, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Recipe Box Server Running (HTTPS - TRUSTED)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Port: ${PORT}`);
        console.log(`Secure: https://localhost:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Rate Limiting: ENABLED`);
        console.log(`SSL: ENABLED (mkcert trusted)`);
        console.log(`Secure Cookies: ENABLED`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Admin: https://localhost:${PORT}/admin-login.html`);
        console.log(`Users: https://localhost:${PORT}/login.html`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info('HTTPS Server started successfully', { port: PORT });
    });
    console.log('HTTPS enabled with mkcert trusted certificates');
} else {
    server = http.createServer(app).listen(PORT, () => {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`Recipe Box Server Running (HTTP)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Port: ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Rate Limiting: ENABLED`);
        console.log(`SSL:DISABLED (certificates not found)`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Admin: http://localhost:${PORT}/admin-login.html`);
        console.log(`Users: http://localhost:${PORT}/login.html`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        logger.info('HTTP Server started successfully', { port: PORT });
    });
    console.log('Running in HTTP mode - SSL certificates not found in ssl folder');
}

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
    });
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Rejection', { error: err });
    console.error('Unhandled Rejection:', err);
    server.close(() => process.exit(1));
});

module.exports = app;