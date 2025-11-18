const API_URL = '/api'; // ← CHANGED TO RELATIVE PATH (RECOMMENDED)
// OR use: const API_URL = 'https://localhost:3000/api';

// Clear errors
function clearErrors() {
    document.querySelectorAll('.error-message').forEach(el => el.textContent = '');
}

// Show error
function showError(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) el.textContent = message;
}

// Admin Login
async function handleAdminLogin() {
    clearErrors();
    
    const identifier = document.getElementById('adminIdentifier').value.trim();
    const password = document.getElementById('adminPassword').value;
    
    if (!identifier) {
        showError('identifierError', 'Username or email is required');
        return;
    }
    
    if (!password) {
        showError('passwordError', 'Password is required');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include', // ← ADD THIS FOR COOKIES/SESSIONS
            body: JSON.stringify({ identifier, password })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            showError('passwordError', data.message || 'Login failed');
            return;
        }
        
        // Store admin token and info
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminInfo', JSON.stringify(data.admin));
        
        // Redirect to admin dashboard
        window.location.href = 'admin-dashboard.html';
        
    } catch (error) {
        console.error('Login error:', error);
        showError('passwordError', 'Connection error. Please try again.');
    }
}

// Enter key handler
document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('adminPassword');
    if (passwordInput) {
        passwordInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleAdminLogin();
        });
    }
    
    const identifierInput = document.getElementById('adminIdentifier');
    if (identifierInput) {
        identifierInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleAdminLogin();
        });
    }
});