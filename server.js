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
const logger = require('./config/logger');
const path = require('path');

const app = express();

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
        }
    }
}));

// CORS - Updated for Vercel
app.use(cors({
    origin: [
        'https://recipebox-jhyj.vercel.app', // Your Vercel domain
        'http://localhost:3000', // Local development
        process.env.FRONTEND_URL // Environment variable
    ].filter(Boolean),
    credentials: true
}));

// Rate Limiting - Adjusted for serverless
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200, // Increased for serverless
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Specific login rate limiter
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        error: 'Too many login attempts from this IP, please try again after 15 minutes'
    },
    skipSuccessfulRequests: false,
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Increased
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
    max: 100, // Increased
    message: {
        success: false,
        error: 'Too many admin requests, please try again later'
    }
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/recipes/create', recipeCreationLimiter);
app.use('/api/admin/', adminLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Session configuration - UPDATED FOR VERCEL
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600,
        // Serverless optimizations
        autoRemove: 'interval',
        autoRemoveInterval: 10
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Auto-detect in Vercel
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict' // Important for Vercel
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
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
        vercel: true
    });
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
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// MongoDB Connection - UPDATED FOR VERCEL
const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI, {
                // Serverless optimizations
                maxPoolSize: 10,
                minPoolSize: 1,
                socketTimeoutMS: 30000,
                serverSelectionTimeoutMS: 30000,
            });
            logger.info('MongoDB connected successfully to Vercel');
            console.log('MongoDB connected to Vercel');
        }
    } catch (error) {
        logger.error('MongoDB connection error', { error: error.message });
        console.error('MongoDB connection failed:', error.message);
        // Don't exit process in serverless
    }
};

// Connect to DB on first request
app.use(async (req, res, next) => {
    await connectDB();
    next();
});

// Vercel requires module.exports = app
module.exports = app;