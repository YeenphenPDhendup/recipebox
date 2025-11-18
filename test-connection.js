require('dotenv').config();
const { MongoClient } = require('mongodb');

console.log('🔍 Debugging MongoDB Connection...');
console.log('MONGODB_URI from .env:', process.env.MONGODB_URI ? 'Present' : 'Missing');

// Mask password for security
if (process.env.MONGODB_URI) {
    const masked = process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@');
    console.log('Connection string:', masked);
}

async function testConnection() {
    if (!process.env.MONGODB_URI) {
        console.log('❌ MONGODB_URI is not defined in .env file');
        return;
    }

    const client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000
    });

    try {
        console.log('🔄 Attempting to connect...');
        await client.connect();
        console.log('✅ Successfully connected to MongoDB Atlas!');
        
        // Test if we can list databases
        const adminDb = client.db().admin();
        const result = await adminDb.listDatabases();
        console.log(`📊 Found ${result.databases.length} databases`);
        
    } catch (error) {
        console.log('❌ Connection failed:', error.message);
        console.log('🔧 Error details:', error.name);
        
        // Specific error handling
        if (error.name === 'MongoServerSelectionError') {
            console.log('💡 This usually means:');
            console.log('   - IP not whitelisted in Atlas');
            console.log('   - Network connectivity issues');
            console.log('   - Cluster is not running');
        } else if (error.name === 'MongoAuthenticationError') {
            console.log('💡 Authentication failed:');
            console.log('   - Wrong username/password');
            console.log('   - User does not exist');
        }
        
    } finally {
        await client.close();
    }
}

testConnection();