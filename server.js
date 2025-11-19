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
        'https://recipebox-jhyj.vercel.app',
        'http://localhost:3000',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true
}));

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: {
        success: false,
        error: 'Too many requests from this IP, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

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

app.use('/api/', generalLimiter);
app.use('/api/auth/login', loginLimiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600,
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
    }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Request logging
app.use((req, res, next) => {
    logger.logRequest(req);
    next();
});

// SIMPLE MongoDB Connection (FIXED)
const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 0) {
            console.log('🔄 Connecting to MongoDB...');
            await mongoose.connect(process.env.MONGODB_URI, {
                maxPoolSize: 5,
                socketTimeoutMS: 30000,
                serverSelectionTimeoutMS: 30000,
            });
            console.log('✅ MongoDB connected successfully');
        }
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }
};

// Connect to database on startup
connectDB();

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const recipeRoutes = require('./routes/recipeRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recipes', recipeRoutes);

// Health check
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
        database: dbStatus
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
    
    // Handle MongoDB connection errors specifically
    if (err.message.includes('before initial connection') || err.name === 'MongooseError') {
        return res.status(503).json({
            success: false,
            message: 'Database connection not ready. Please try again.',
            error: 'DATABASE_NOT_READY'
        });
    }
    
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

module.exports = app;