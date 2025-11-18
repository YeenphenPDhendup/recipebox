const { execSync } = require('child_process');
console.log('Setting up trusted SSL...');
try {
    execSync('mkcert -install', { stdio: 'inherit' });
    execSync('mkcert -key-file ssl/key.pem -cert-file ssl/cert.pem localhost 127.0.0.1 ::1', { stdio: 'inherit' });
    console.log('Trusted SSL ready! Restart server with: npm start');
} catch (e) {
    console.log('Install mkcert first: choco install mkcert');
}