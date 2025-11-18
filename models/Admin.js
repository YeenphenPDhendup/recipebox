const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Admin username is required'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    role: {
        type: String,
        default: 'admin',
        immutable: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date
    }
}, {
    timestamps: true
});

// Indexes
adminSchema.index({ email: 1 });
adminSchema.index({ username: 1 });

// Virtual for account locked status
adminSchema.virtual('isLocked').get(function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save: Hash password
adminSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method: Compare password
adminSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method: Generate JWT token
adminSchema.methods.generateAuthToken = function() {
    const payload = {
        id: this._id,
        username: this.username,
        role: 'admin',
        isAdmin: true
    };
    
    return jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN || '7d',
            issuer: 'RecipeBox',
            audience: 'RecipeBoxAdmins'
        }
    );
};

// Method: Increment login attempts
adminSchema.methods.incLoginAttempts = async function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const lockTime = parseInt(process.env.LOCK_TIME) || 15;
    
    if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked) {
        updates.$set = { lockUntil: Date.now() + lockTime * 60 * 1000 };
    }
    
    return this.updateOne(updates);
};

// Method: Reset login attempts
adminSchema.methods.resetLoginAttempts = function() {
    return this.updateOne({
        $set: { loginAttempts: 0, lastLogin: Date.now() },
        $unset: { lockUntil: 1 }
    });
};

// Static: Find by credentials
adminSchema.statics.findByCredentials = async function(identifier, password) {
    const admin = await this.findOne({
        $or: [
            { email: identifier.toLowerCase() },
            { username: identifier }
        ],
        isActive: true
    }).select('+password');
    
    if (!admin) {
        throw new Error('Invalid admin credentials');
    }
    
    if (admin.isLocked) {
        throw new Error(`Account locked. Try again after ${Math.ceil((admin.lockUntil - Date.now()) / 60000)} minutes`);
    }
    
    const isMatch = await admin.comparePassword(password);
    
    if (!isMatch) {
        await admin.incLoginAttempts();
        throw new Error('Invalid admin credentials');
    }
    
    if (admin.loginAttempts > 0 || admin.lockUntil) {
        await admin.resetLoginAttempts();
    }
    
    return admin;
};

// Remove sensitive data from JSON
adminSchema.methods.toJSON = function() {
    const admin = this.toObject();
    delete admin.password;
    delete admin.loginAttempts;
    delete admin.lockUntil;
    return admin;
};

const Admin = mongoose.model('Admin', adminSchema);

module.exports = Admin;