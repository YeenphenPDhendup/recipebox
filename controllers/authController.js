const User = require('../models/User');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email'); // NEW: Nodemailer

// @desc    User signup
// @route   POST /api/auth/signup
// @access  Public
exports.signup = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg
            });
        }

        const { username, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: existingUser.email === email 
                    ? 'Email already registered' 
                    : 'Username already taken'
            });
        }

        // Create user with mandatory 2FA
        const user = await User.create({
            username,
            email,
            password,
            twoFactorEnabled: true // MANDATORY 2FA
        });

        logger.info('New user registered with mandatory 2FA', {
            userId: user._id,
            username: user.username,
            ip: req.ip
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully. 2FA is enabled for security.',
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        logger.error('Signup error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error creating account'
        });
    }
};

// @desc    User login
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg
            });
        }

        const { identifier, password } = req.body;

        // Find user and validate credentials
        const user = await User.findByCredentials(identifier, password);

        // Update last login
        user.lastLogin = Date.now();
        user.lastLoginIP = req.ip;
        await user.save();

        // MANDATORY 2FA - Always require 2FA verification
        // Send 2FA OTP
        const otp = user.generateOtp();
        await user.save({ validateBeforeSave: false });

        // Send OTP via Nodemailer - UPDATED
        try {
            const emailResult = await sendEmail(
                user.email,
                '2FA Login Code - Recipe Box',
                `Your 2FA verification code is: ${otp}\n\nThis code will expire in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.\n\nIf you didn't request this login, please secure your account.`,
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f97316;">Recipe Box - 2FA Verification</h2>
                    <p>Your 2FA verification code is:</p>
                    <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in <strong>${process.env.OTP_EXPIRY_MINUTES || 5} minutes</strong>.</p>
                    <p><small>If you didn't request this login, please secure your account immediately.</small></p>
                </div>
                `
            );

            if (!emailResult.success) {
                logger.error('2FA OTP email error', { error: emailResult.error, email: user.email });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send 2FA OTP'
                });
            }
        } catch (emailError) {
            logger.error('2FA email sending failed', { error: emailError.message });
            return res.status(500).json({
                success: false,
                message: 'Failed to send 2FA OTP'
            });
        }

        logger.info('2FA required for login', {
            userId: user._id,
            username: user.username,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: '2FA verification required',
            requires2FA: true,
            email: user.email
        });

    } catch (error) {
        logger.security('Login failed', {
            error: error.message,
            ip: req.ip
        });

        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    User logout
// @route   POST /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
    // Clear JWT token cookie
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    });

    // ✅ FIXED: Destroy the session properly
    req.session.destroy((err) => {
        if (err) {
            logger.error('Session destruction error', { error: err.message });
            return res.status(500).json({
                success: false,
                message: 'Error during logout'
            });
        }

        // Clear session cookie
        res.clearCookie('connect.sid', {
            path: '/',
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        logger.info('User logged out successfully', {
            userId: req.user._id,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    });
};

// @desc    Forgot password - Send OTP
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        // Select OTP fields explicitly
        const user = await User.findOne({ 
            email: email.toLowerCase() 
        });

        if (!user) {
            // For security, don't reveal if email exists
            return res.json({
                success: true,
                message: 'If the email exists, an OTP has been sent'
            });
        }

        // Generate OTP using new User model method
        const otp = user.generateOtp();
        
        // Track OTP request
        user.otpRequests.push({
            type: 'password_reset',
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });
        
        await user.save({ validateBeforeSave: false });

        // Send OTP via Nodemailer - UPDATED
        try {
            const emailResult = await sendEmail(
                email,
                'Password Reset OTP - Recipe Box',
                `Your OTP for password reset is: ${otp}\n\nThis OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.\n\nIf you didn't request this, please ignore this email.`,
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f97316;">Recipe Box - Password Reset</h2>
                    <p>Your OTP for password reset is:</p>
                    <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This OTP will expire in <strong>${process.env.OTP_EXPIRY_MINUTES || 5} minutes</strong>.</p>
                    <p><small>If you didn't request this password reset, please ignore this email.</small></p>
                </div>
                `
            );

            if (!emailResult.success) {
                logger.error('Password reset email error', { error: emailResult.error, email });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send OTP email'
                });
            }

            logger.info('OTP email sent successfully', {
                userId: user._id,
                email: email,
                ip: req.ip
            });

        } catch (emailError) {
            logger.error('Email sending failed', { error: emailError.message });
            return res.status(500).json({
                success: false,
                message: 'Failed to send OTP email'
            });
        }

        res.status(200).json({
            success: true,
            message: 'OTP sent to your email'
        });

    } catch (error) {
        logger.error('Forgot password error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error processing request'
        });
    }
};

// @desc    Send 2FA OTP to email
// @route   POST /api/auth/send-2fa-otp
// @access  Public
exports.send2FAOTP = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            // For security, don't reveal if user exists
            return res.json({
                success: true,
                message: 'If the email exists, an OTP has been sent to your email'
            });
        }

        // Generate and send OTP
        const otp = user.generateOtp();
        await user.save({ validateBeforeSave: false });

        // Send OTP via Nodemailer - UPDATED
        try {
            const emailResult = await sendEmail(
                email,
                '2FA Login Code - Recipe Box',
                `Your 2FA verification code is: ${otp}\n\nThis code will expire in ${process.env.OTP_EXPIRY_MINUTES || 5} minutes.\n\nIf you didn't request this, please secure your account.`,
                `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #f97316;">Recipe Box - 2FA Verification</h2>
                    <p>Your 2FA verification code is:</p>
                    <div style="background: #f3f4f6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                        ${otp}
                    </div>
                    <p>This code will expire in <strong>${process.env.OTP_EXPIRY_MINUTES || 5} minutes</strong>.</p>
                    <p><small>If you didn't request this, please secure your account immediately.</small></p>
                </div>
                `
            );

            if (!emailResult.success) {
                logger.error('2FA OTP email error', { error: emailResult.error, email });
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send 2FA OTP'
                });
            }

            logger.info('2FA OTP sent', {
                userId: user._id,
                email: email,
                ip: req.ip
            });

        } catch (emailError) {
            logger.error('2FA email sending failed', { error: emailError.message });
            return res.status(500).json({
                success: false,
                message: 'Failed to send 2FA OTP'
            });
        }

        res.status(200).json({
            success: true,
            message: '2FA OTP sent to your email'
        });

    } catch (error) {
        logger.error('Send 2FA OTP error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error sending 2FA OTP'
        });
    }
};

// @desc    Verify 2FA OTP and complete login
// @route   POST /api/auth/verify-2fa
// @access  Public
exports.verify2FA = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

        // Verify OTP
        try {
            user.verifyOtp(otp);
            await user.save();
        } catch (otpError) {
            return res.status(400).json({
                success: false,
                message: otpError.message
            });
        }

        // Generate final auth token (same as regular login)
        const token = user.generateAuthToken();

        // Set cookie
        const cookieOptions = {
            expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        };

        res.cookie('token', token, cookieOptions);

        // Clear OTP after successful verification
        user.otp = undefined;
        await user.save();

        logger.info('2FA verification successful', {
            userId: user._id,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        });

    } catch (error) {
        logger.error('2FA verification error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error verifying 2FA'
        });
    }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        // Select OTP fields explicitly
        const user = await User.findOne({ 
            email: email.toLowerCase() 
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid request'
            });
        }

        // Verify OTP using new User model method
        try {
            user.verifyOtp(otp);
            await user.save();
        } catch (otpError) {
            return res.status(400).json({
                success: false,
                message: otpError.message
            });
        }

        // Generate secure reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        user.resetPasswordTokens = user.resetPasswordTokens || [];
        user.resetPasswordTokens.push({
            token: resetToken,
            expiresAt: resetExpires
        });

        await user.save();

        logger.info('OTP verified successfully', {
            userId: user._id,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'OTP verified successfully',
            resetToken
        });

    } catch (error) {
        logger.error('OTP verification error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error verifying OTP'
        });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Password validation
        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/;
        if (newPassword.length < 8 || !passwordRegex.test(newPassword)) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters with 1 number and 1 special character'
            });
        }

        const user = await User.findOne({
            email: email.toLowerCase(),
            'resetPasswordTokens': {
                $elemMatch: {
                    token: resetToken,
                    expiresAt: { $gt: new Date() }
                }
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Check if OTP was verified
        if (!user.otp || !user.otp.verified) {
            return res.status(400).json({
                success: false,
                message: 'OTP verification required'
            });
        }

        // Update password
        user.password = newPassword;
        user.otp = undefined; // Clear OTP
        user.resetPasswordTokens = user.resetPasswordTokens.filter(token => 
            token.token !== resetToken
        );
        
        await user.save();

        logger.security('Password reset successful', {
            userId: user._id,
            ip: req.ip
        });

        res.status(200).json({
            success: true,
            message: 'Password reset successfully'
        });

    } catch (error) {
        logger.error('Password reset error', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error resetting password'
        });
    }
};