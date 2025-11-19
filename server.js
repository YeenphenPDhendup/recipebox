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

// MongoDB Connection - IMPROVED FOR VERCEL
const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 0) {
            // Close any existing connections first
            await mongoose.disconnect();
            
            await mongoose.connect(process.env.MONGODB_URI, {
                // Aggressive timeouts for serverless
                maxPoolSize: 5,
                minPoolSize: 1,
                socketTimeoutMS: 10000,
                connectTimeoutMS: 10000,
                serverSelectionTimeoutMS: 10000,
                maxIdleTimeMS: 20000,
                waitQueueTimeoutMS: 10000,
                bufferCommands: false, // Disable buffering
                bufferMaxEntries: 0
            });
            console.log('✅ MongoDB connected to Vercel');
        }
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
        // Don't throw error, just log it
    }
};

// Enhanced connection middleware with caching
let connectionPromise = null;
let isConnecting = false;

const ensureDatabaseConnection = async (req, res, next) => {
    try {
        // If already connected, proceed
        if (mongoose.connection.readyState === 1) {
            return next();
        }

        // If connecting in progress, wait for it
        if (isConnecting && connectionPromise) {
            await connectionPromise;
            return next();
        }

        // Start new connection
        isConnecting = true;
        connectionPromise = connectDB();
        await connectionPromise;
        isConnecting = false;
        
        next();
    } catch (error) {
        console.error('Database connection middleware error:', error);
        isConnecting = false;
        
        // Continue anyway - some routes might work without DB
        next();
    }
};

// Apply database connection middleware to API routes
app.use('/api/', ensureDatabaseConnection);

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const recipeRoutes = require('./routes/recipeRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recipes', recipeRoutes);

// Health check with DB status
app.get('/health', async (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
        vercel: true,
        database: dbStatus,
        mongooseState: mongoose.connection.readyState
    });
});

// Simple test route without DB dependency
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is running!',
        timestamp: new Date(),
        environment: process.env.NODE_ENV
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

// Vercel requires module.exports = app
module.exports = app;