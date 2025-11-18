const crypto = require('crypto');
const logger = require('../config/logger');

// AES-256-CBC encryption for sensitive data at rest
class Encryption {
    constructor() {
        // Encryption key must be 32 bytes for AES-256
        this.algorithm = 'aes-256-cbc';
        this.key = Buffer.from(process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex').slice(0, 32));
        
        // Validate key length
        if (this.key.length !== 32) {
            throw new Error('Encryption key must be 32 bytes for AES-256');
        }
    }

    /**
     * Encrypt sensitive data
     * @param {string} text - Plain text to encrypt
     * @returns {string} - Encrypted text with IV prepended
     */
    encrypt(text) {
        try {
            if (!text) return null;
            
            // Generate random IV for each encryption
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Prepend IV to encrypted data (IV:ENCRYPTED)
            return `${iv.toString('hex')}:${encrypted}`;
        } catch (error) {
            logger.error('Encryption error', { error: error.message });
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt sensitive data
     * @param {string} encryptedText - Encrypted text with IV prepended
     * @returns {string} - Decrypted plain text
     */
    decrypt(encryptedText) {
        try {
            if (!encryptedText) return null;
            
            // Split IV and encrypted data
            const parts = encryptedText.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted data format');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            logger.error('Decryption error', { error: error.message });
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Hash sensitive data (one-way)
     * @param {string} data - Data to hash
     * @returns {string} - SHA-256 hash
     */
    hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    /**
     * Generate secure random token
     * @param {number} bytes - Number of random bytes
     * @returns {string} - Random token
     */
    generateToken(bytes = 32) {
        return crypto.randomBytes(bytes).toString('hex');
    }

    /**
     * Compare hash with plain text
     * @param {string} plainText - Plain text
     * @param {string} hash - Hash to compare
     * @returns {boolean} - Match result
     */
    compareHash(plainText, hash) {
        return this.hash(plainText) === hash;
    }
}

module.exports = new Encryption();