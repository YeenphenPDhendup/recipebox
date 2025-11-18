const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const encryption = require('../utils/encryption');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [30, 'Username must not exceed 30 characters'],
        match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    // Encrypted email for additional security
    emailEncrypted: {
        type: String,
        select: false
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        validate: {
            validator: function(password) {
                // At least 8 characters, 1 number, 1 special character
                return /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password);
            },
            message: 'Password must contain at least 1 number and 1 special character'
        },
        select: false // Don't return password in queries by default
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    // Security fields
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    },
    lastLogin: {
        type: Date
    },
    lastLoginIP: {
        type: String
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    twoFactorSecret: {
        type: String,
        select: false
    },
    // CHANGED: 2FA is now mandatory for all users
    twoFactorEnabled: {
        type: Boolean,
        default: true, // Changed from false to true - MANDATORY
        required: true
    },
    // OTP fields
    otp: {
        code: String,
        expiresAt: Date,
        attempts: {
            type: Number,
            default: 0
        },
        verified: {
            type: Boolean,
            default: false
        }
    },
    resetPasswordTokens: [{
        token: String,
        expiresAt: Date,
        used: {
            type: Boolean,
            default: false
        }
    }],
    otpRequests: [{
        type: {
            type: String,
            enum: ['password_reset', 'email_verification'],
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        ip: String,
        userAgent: String
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance and security
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ lastLogin: -1 });

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method: Check if OTP is expired
userSchema.methods.isOtpExpired = function() {
    return this.otp && this.otp.expiresAt && this.otp.expiresAt < new Date();
};

// Method: Check if OTP attempts exceeded
userSchema.methods.isOtpAttemptsExceeded = function() {
    const maxAttempts = parseInt(process.env.MAX_OTP_ATTEMPTS) || 3;
    return this.otp && this.otp.attempts >= maxAttempts;
};

// Pre-save middleware: Hash password and encrypt email
userSchema.pre('save', async function(next) {
    // Only hash password if it's modified
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with bcrypt (cost factor from env)
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        
        // Update passwordChangedAt
        if (!this.isNew) {
            this.passwordChangedAt = Date.now() - 1000;
        }
        
        next();
    } catch (error) {
        next(error);
    }
});

// Pre-save middleware: Encrypt email
userSchema.pre('save', function(next) {
    if (this.isModified('email')) {
        this.emailEncrypted = encryption.encrypt(this.email);
    }
    next();
});

// Method: Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method: Generate JWT token
userSchema.methods.generateAuthToken = function() {
    const payload = {
        id: this._id,
        username: this.username,
        role: this.role
    };
    
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            issuer: 'RecipeBox',
            audience: 'RecipeBoxUsers'
        }
    );
};

// Method: Check if password changed after JWT issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Method: Create password reset token
userSchema.methods.createPasswordResetToken = function() {
    // Generate random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash and save to database
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    // Set expiry (5 minutes)
    this.passwordResetExpires = Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 5) * 60 * 1000;
    
    return resetToken;
};

// Method: Generate OTP
userSchema.methods.generateOtp = function() {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 5) * 60 * 1000);
    
    this.otp = {
        code: otp,
        expiresAt: expiresAt,
        attempts: 0,
        verified: false
    };
    
    return otp;
};

// Method: Verify OTP
userSchema.methods.verifyOtp = function(enteredOtp) {
    if (!this.otp || !this.otp.code) {
        throw new Error('No OTP found');
    }
    
    if (this.isOtpExpired()) {
        throw new Error('OTP has expired');
    }
    
    if (this.isOtpAttemptsExceeded()) {
        throw new Error('Too many OTP attempts');
    }
    
    const isMatch = this.otp.code === enteredOtp;
    
    if (!isMatch) {
        this.otp.attempts += 1;
        throw new Error('Invalid OTP');
    }
    
    // OTP is valid
    this.otp.verified = true;
    return true;
};

// Method: Clear OTP
userSchema.methods.clearOtp = function() {
    this.otp = undefined;
};

// Method: Increment login attempts
userSchema.methods.incLoginAttempts = async function() {
    // If lock has expired, reset attempts
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockTime = parseInt(process.env.LOCK_TIME) || 15; // minutes
    
    // Lock account after max attempts
    if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + lockTime * 60 * 1000 };
    }
    
    return this.updateOne(updates);
};

// Method: Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0, lastLogin: Date.now() },
        $unset: { lockUntil: 1 }
    });
};

// Static method: Find by credentials (with account locking)
userSchema.statics.findByCredentials = async function(identifier, password) {
    // Find user by email or username
    const user = await this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier }
        ],
        isActive: true
    }).select('+password +twoFactorEnabled'); // CHANGED: Include twoFactorEnabled in query
    
    if (!user) {
        throw new Error('Invalid credentials');
    }
    
    // Check if account is locked
    if (user.isLocked) {
        throw new Error(`Account locked. Try again after ${Math.ceil((user.lockUntil - Date.now()) / 60000)} minutes`);
    }
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
        await user.incLoginAttempts();
        throw new Error('Invalid credentials');
    }
    
    // Reset login attempts on successful login
    if (user.loginAttempts > 0 || user.lockUntil) {
        await user.resetLoginAttempts();
    }
    
    return user;
};

// Remove sensitive data from JSON output
userSchema.methods.toJSON = function() {
    const user = this.toObject();
    delete user.password;
    delete user.passwordResetToken;
    delete user.passwordResetExpires;
    delete user.emailVerificationToken;
    delete user.emailEncrypted;
    delete user.twoFactorSecret;
    delete user.loginAttempts;
    delete user.lockUntil;
    delete user.otp;
    return user;
};

const User = mongoose.model('User', userSchema);

module.exports = User;