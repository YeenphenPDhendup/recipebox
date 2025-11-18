require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const logger = require('../config/logger');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/recipebox', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Default admin credentials
const createDefaultAdmin = async () => {
    try {
        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username: 'admin' });
        
        if (existingAdmin) {
            console.log('Admin already exists!');
            console.log('Username: admin');
            process.exit(0);
        }
        
        // Create admin
        const admin = await Admin.create({
            username: 'admin',
            email: 'admin@recipebox.com',
            password: 'Admin@123' // Change this in production!
        });
        
        console.log('Admin created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Admin Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Username: admin');
        console.log('Email: admin@recipebox.com');
        console.log('Password: Admin@123');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('IMPORTANT: Change the password after first login!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        logger.info('Default admin created', { adminId: admin._id });
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error.message);
        logger.error('Admin creation failed', { error: error.message });
        process.exit(1);
    }
};

// Custom admin creation (interactive)
const createCustomAdmin = async () => {
    try {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const question = (query) => new Promise((resolve) => readline.question(query, resolve));
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Create Custom Admin');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const username = await question('Enter admin username: ');
        const email = await question('Enter admin email: ');
        const password = await question('Enter admin password (min 6 chars): ');
        
        readline.close();
        
        if (!username || !email || !password) {
            console.log('All fields are required!');
            process.exit(1);
        }
        
        if (password.length < 6) {
            console.log('Password must be at least 6 characters!');
            process.exit(1);
        }
        
        // Check if admin exists
        const existingAdmin = await Admin.findOne({
            $or: [{ username }, { email }]
        });
        
        if (existingAdmin) {
            console.log('Admin with this username or email already exists!');
            process.exit(1);
        }
        
        // Create admin
        const admin = await Admin.create({ username, email, password });
        
        console.log('Admin created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Admin Details:');
        console.log(`Username: ${username}`);
        console.log(`Email: ${email}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        logger.info('Custom admin created', { adminId: admin._id, username });
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error.message);
        logger.error('Admin creation failed', { error: error.message });
        process.exit(1);
    }
};

// Get command line argument
const args = process.argv.slice(2);

if (args.includes('--custom')) {
    createCustomAdmin();
} else {
    createDefaultAdmin();
}

/*
USAGE:
------
1. Create default admin:
   node scripts/createAdmin.js

2. Create custom admin:
   node scripts/createAdmin.js --custom

Default credentials:
- Username: admin
- Email: admin@recipebox.com
- Password: Admin@123
*/