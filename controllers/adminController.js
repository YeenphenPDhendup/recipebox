const Admin = require('../models/Admin');
const User = require('../models/User');
const Recipe = require('../models/Recipe');
const logger = require('../config/logger');

// @desc    Admin login
// @route   POST /api/admin/login
// @access  Public
exports.adminLogin = async (req, res) => {
    try {
        const { identifier, password } = req.body;
        
        // Input validation
        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email/username and password'
            });
        }
        
        // Find admin and validate credentials
        const admin = await Admin.findByCredentials(identifier, password);
        
        // Generate token
        const token = admin.generateAuthToken();
        
        // Set secure cookie
        const cookieOptions = {
            expires: new Date(Date.now() + (parseInt(process.env.JWT_COOKIE_EXPIRES_IN) || 7) * 24 * 60 * 60 * 1000),
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        };
        
        res.cookie('token', token, cookieOptions);
        
        logger.info('Admin logged in successfully', {
            adminId: admin._id,
            username: admin.username,
            ip: req.ip
        });
        
        res.status(200).json({
            success: true,
            message: 'Admin logged in successfully',
            token,
            admin: {
                id: admin._id,
                username: admin.username,
                email: admin.email,
                role: 'admin'
            }
        });
        
    } catch (error) {
        logger.security('Admin login failed', {
            error: error.message,
            ip: req.ip,
            identifier: req.body.identifier
        });
        
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
};

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Admin only
exports.getDashboardStats = async (req, res) => {
    try {
        // Get total users
        const totalUsers = await User.countDocuments({ isActive: true });
        const totalInactiveUsers = await User.countDocuments({ isActive: false });
        
        // Get total recipes
        const totalRecipes = await Recipe.countDocuments();
        
        // Get users registered today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const usersToday = await User.countDocuments({
            createdAt: { $gte: today }
        });
        
        // Get recent users
        const recentUsers = await User.find()
            .select('username email createdAt lastLogin')
            .sort({ createdAt: -1 })
            .limit(10);
        
        logger.info('Admin accessed dashboard', {
            adminId: req.user._id,
            ip: req.ip
        });
        
        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                totalInactiveUsers,
                totalRecipes,
                usersToday,
                recentUsers
            }
        });
        
    } catch (error) {
        logger.error('Error fetching dashboard stats', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics'
        });
    }
};

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Admin only
exports.getAllUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Search functionality
        let query = {};
        if (req.query.search) {
            query = {
                $or: [
                    { username: { $regex: req.query.search, $options: 'i' } },
                    { email: { $regex: req.query.search, $options: 'i' } }
                ]
            };
        }
        
        // Filter by status
        if (req.query.status) {
            query.isActive = req.query.status === 'active';
        }
        
        const users = await User.find(query)
            .select('username email createdAt lastLogin isActive role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        const total = await User.countDocuments(query);
        
        logger.info('Admin fetched users list', {
            adminId: req.user._id,
            page,
            total,
            ip: req.ip
        });
        
        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(total / limit),
                    totalUsers: total,
                    perPage: limit
                }
            }
        });
        
    } catch (error) {
        logger.error('Error fetching users', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching users'
        });
    }
};

// @desc    Get single user details
// @route   GET /api/admin/users/:id
// @access  Admin only
exports.getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Get user's recipe count
        const recipeCount = await Recipe.countDocuments({ userId: user._id });
        
        logger.info('Admin viewed user details', {
            adminId: req.user._id,
            targetUserId: user._id,
            ip: req.ip
        });
        
        res.status(200).json({
            success: true,
            data: {
                user,
                recipeCount
            }
        });
        
    } catch (error) {
        logger.error('Error fetching user details', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error fetching user details'
        });
    }
};

// @desc    Delete user (Admin only action)
// @route   DELETE /api/admin/users/:id
// @access  Admin only
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Prevent admin from deleting themselves if they're in user collection
        if (user._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete your own account'
            });
        }
        
        // Delete all user's recipes
        await Recipe.deleteMany({ userId: user._id });
        
        // Delete user
        await User.findByIdAndDelete(req.params.id);
        
        logger.security('Admin deleted user', {
            adminId: req.user._id,
            deletedUserId: user._id,
            deletedUsername: user.username,
            ip: req.ip
        });
        
        res.status(200).json({
            success: true,
            message: `User ${user.username} and all their recipes deleted successfully`
        });
        
    } catch (error) {
        logger.error('Error deleting user', { 
            error: error.message,
            adminId: req.user._id,
            targetUserId: req.params.id
        });
        
        res.status(500).json({
            success: false,
            message: 'Error deleting user'
        });
    }
};

// @desc    Deactivate/Activate user
// @route   PATCH /api/admin/users/:id/status
// @access  Admin only
exports.toggleUserStatus = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        user.isActive = !user.isActive;
        await user.save();
        
        logger.security('Admin toggled user status', {
            adminId: req.user._id,
            targetUserId: user._id,
            newStatus: user.isActive ? 'active' : 'inactive',
            ip: req.ip
        });
        
        res.status(200).json({
            success: true,
            message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
            data: { isActive: user.isActive }
        });
        
    } catch (error) {
        logger.error('Error toggling user status', { error: error.message });
        res.status(500).json({
            success: false,
            message: 'Error updating user status'
        });
    }
};

// @desc    Admin logout
// @route   POST /api/admin/logout
// @access  Admin only
exports.adminLogout = (req, res) => {
    res.cookie('token', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true
    });
    
    logger.info('Admin logged out', {
        adminId: req.user._id,
        ip: req.ip
    });
    
    res.status(200).json({
        success: true,
        message: 'Admin logged out successfully'
    });
};