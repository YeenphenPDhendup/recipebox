const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Admin = require('../models/Admin');
const logger = require('../config/logger');

// Protect routes - require authentication
exports.protect = async (req, res, next) => {
    try {
        let token;
        
        // Get token from header or cookie
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        
        if (!token) {
            logger.security('Unauthorized access attempt', {
                ip: req.ip,
                url: req.originalUrl
            });
            return res.status(401).json({
                success: false,
                message: 'Not authorized to access this route'
            });
        }
        
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user/admin still exists
        let currentUser;
        if (decoded.isAdmin) {
            currentUser = await Admin.findById(decoded.id);
        } else {
            currentUser = await User.findById(decoded.id);
        }
        
        if (!currentUser) {
            logger.security('Token valid but user not found', {
                userId: decoded.id,
                ip: req.ip
            });
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }
        
        // Check if user is active
        if (!currentUser.isActive) {
            logger.security('Inactive user access attempt', {
                userId: decoded.id,
                ip: req.ip
            });
            return res.status(401).json({
                success: false,
                message: 'User account is deactivated'
            });
        }
        
        // Check if user changed password after token was issued
        if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
            logger.security('Token used after password change', {
                userId: decoded.id,
                ip: req.ip
            });
            return res.status(401).json({
                success: false,
                message: 'Password recently changed. Please log in again'
            });
        }
        
        // Grant access
        req.user = currentUser;
        req.isAdmin = decoded.isAdmin || false;
        next();
        
    } catch (error) {
        logger.security('Token verification failed', {
            error: error.message,
            ip: req.ip
        });
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

// Restrict to specific roles
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }
        
        const userRole = req.isAdmin ? 'admin' : req.user.role;
        
        if (!roles.includes(userRole)) {
            logger.security('Unauthorized role access attempt', {
                userId: req.user.id,
                role: userRole,
                requiredRoles: roles,
                ip: req.ip,
                url: req.originalUrl
            });
            
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action'
            });
        }
        
        next();
    };
};

// Admin only middleware
exports.adminOnly = (req, res, next) => {
    if (!req.isAdmin) {
        logger.security('Non-admin access attempt to admin route', {
            userId: req.user?.id,
            ip: req.ip,
            url: req.originalUrl
        });
        
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
};

// Optional auth - doesn't fail if no token
exports.optionalAuth = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.token) {
            token = req.cookies.token;
        }
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            if (decoded.isAdmin) {
                req.user = await Admin.findById(decoded.id);
                req.isAdmin = true;
            } else {
                req.user = await User.findById(decoded.id);
                req.isAdmin = false;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};