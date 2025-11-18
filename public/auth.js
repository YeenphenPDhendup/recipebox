// API Configuration
const API_BASE_URL = '/api/auth';

// Add this at the top - DUPLICATE REQUEST PREVENTION
let isLoginInProgress = false;
let is2FAVerificationInProgress = false;

// Utility Functions
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPassword(password) {
    // Updated password validation: at least 8 chars, 1 uppercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
}

function getPasswordStrength(password) {
    let strength = 0;
    let feedback = [];
    
    if (password.length >= 8) strength++;
    else feedback.push('at least 8 characters');
    
    if (/[A-Z]/.test(password)) strength++;
    else feedback.push('one uppercase letter');
    
    if (/[a-z]/.test(password)) strength++;
    else feedback.push('one lowercase letter');
    
    if (/\d/.test(password)) strength++;
    else feedback.push('one number');
    
    if (/[@$!%*?&]/.test(password)) strength++;
    else feedback.push('one special character (@$!%*?&)');
    
    return { strength, feedback };
}

function updatePasswordStrengthIndicator(password) {
    const indicator = document.getElementById('passwordStrength');
    const requirements = document.getElementById('passwordRequirements');
    
    if (!indicator || !requirements) return;
    
    const { strength, feedback } = getPasswordStrength(password);
    
    // Update strength indicator
    indicator.textContent = `Strength: ${strength}/5`;
    indicator.className = 'password-strength';
    
    if (strength <= 2) {
        indicator.classList.add('weak');
    } else if (strength <= 4) {
        indicator.classList.add('medium');
    } else {
        indicator.classList.add('strong');
    }
    
    // Update requirements list
    requirements.innerHTML = '';
    const requirementsList = [
        { test: password.length >= 8, text: 'At least 8 characters' },
        { test: /[A-Z]/.test(password), text: 'One uppercase letter' },
        { test: /[a-z]/.test(password), text: 'One lowercase letter' },
        { test: /\d/.test(password), text: 'One number' },
        { test: /[@$!%*?&]/.test(password), text: 'One special character (@$!%*?&)' }
    ];
    
    requirementsList.forEach(req => {
        const li = document.createElement('li');
        li.textContent = req.text;
        li.className = req.test ? 'requirement-met' : 'requirement-unmet';
        requirements.appendChild(li);
    });
}

function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(el => el.textContent = '');
    
    // Also clear password strength indicator if it exists
    const indicator = document.getElementById('passwordStrength');
    if (indicator) {
        indicator.textContent = '';
        indicator.className = 'password-strength';
    }
    
    const requirements = document.getElementById('passwordRequirements');
    if (requirements) {
        requirements.innerHTML = '';
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
    }
}

function showMessage(message, type = 'success') {
    // Create a better notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 5px;
        z-index: 1000;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Form Visibility Management
function showLoginForm() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('twoFactorForm').classList.add('hidden');
    document.getElementById('forgotPasswordForm').classList.add('hidden');
    document.getElementById('otpVerificationForm').classList.add('hidden');
    document.getElementById('resetPasswordForm').classList.add('hidden');
    clearErrors();
}

function showTwoFactorForm() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('twoFactorForm').classList.remove('hidden');
    clearErrors();
}

function showForgotPassword() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('forgotPasswordForm').classList.remove('hidden');
    clearErrors();
}

function showOTPVerification() {
    document.getElementById('forgotPasswordForm').classList.add('hidden');
    document.getElementById('otpVerificationForm').classList.remove('hidden');
}

function showResetPassword() {
    document.getElementById('otpVerificationForm').classList.add('hidden');
    document.getElementById('resetPasswordForm').classList.remove('hidden');
}

// API Helper Function
async function apiCall(endpoint, method = 'GET', data = null, customHeaders = {}) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...customHeaders
        },
        credentials: 'include' // Important for sessions/cookies
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const result = await response.json();
        
        return {
            success: response.ok,
            data: result,
            status: response.status
        };
    } catch (error) {
        console.error('API call failed:', error);
        return {
            success: false,
            error: 'Network error. Please try again.',
            status: 0
        };
    }
}

// Button Loading State
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.dataset.originalText = button.textContent;
        button.textContent = 'Loading...';
        button.disabled = true;
    } else {
        button.textContent = button.dataset.originalText;
        button.disabled = false;
    }
}

// Timer functions for 2FA and OTP
let twoFATimerInterval = null;
let otpTimerInterval = null;

function startTimer(timerElement, minutes, onExpire) {
    let time = minutes * 60;
    
    const interval = setInterval(() => {
        const minutes = Math.floor(time / 60);
        const seconds = time % 60;
        timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (time <= 0) {
            clearInterval(interval);
            if (onExpire) onExpire();
        }
        time--;
    }, 1000);
    
    return interval;
}

function stopTimer(interval) {
    if (interval) {
        clearInterval(interval);
    }
}

// 2FA State
let currentEmail = '';
let resetToken = '';

// Login Functionality with 2FA Support - UPDATED WITH DUPLICATE PREVENTION
async function handleLogin() {
    // Prevent duplicate requests
    if (isLoginInProgress) {
        console.log('⚠️ Login already in progress, ignoring duplicate request');
        return;
    }
    
    clearErrors();
    
    const identifier = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!identifier) {
        showError('loginIdentifierError', 'Email or username is required');
        return;
    }
    
    if (!password) {
        showError('loginPasswordError', 'Password is required');
        return;
    }

    const loginBtn = document.getElementById('loginBtn');
    setButtonLoading(loginBtn, true);
    isLoginInProgress = true; // Lock to prevent duplicates

    try {
        console.log('🔐 Sending login request...');
        const result = await apiCall('/login', 'POST', {
            identifier,
            password
        });

        console.log('📡 Login response received:', result);

        if (result.success) {
            if (result.data.requires2FA === true) {
                console.log('🔄 2FA required, showing form');
                
                // Show 2FA form
                currentEmail = result.data.email;
                showTwoFactorForm();
                
                // Start 2FA timer
                stopTimer(twoFATimerInterval);
                twoFATimerInterval = startTimer(document.getElementById('twoFATimer'), 5, () => {
                    showError('twoFAError', '2FA code has expired. Please request a new one.');
                });
                
                showMessage('2FA code sent to your email', 'success');
            } else {
                // Regular login successful (no 2FA)
                console.log('✅ Regular login successful - no 2FA required');
                showMessage('Login successful! Redirecting...', 'success');
                
                // Store user info
                if (result.data.user) {
                    sessionStorage.setItem('currentUser', result.data.user.username);
                    sessionStorage.setItem('userEmail', result.data.user.email);
                    sessionStorage.setItem('userId', result.data.user.id);
                }
                if (result.data.token) {
                    localStorage.setItem('token', result.data.token);
                }
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            }
        } else {
            console.log('❌ Login failed:', result.data);
            if (result.data.message && result.data.message.includes('identifier')) {
                showError('loginIdentifierError', result.data.message);
            } else if (result.data.message && result.data.message.includes('password')) {
                showError('loginPasswordError', result.data.message);
            } else {
                showError('loginPasswordError', result.data.message || 'Login failed!');
            }
        }
    } catch (error) {
        console.error('💥 Login error:', error);
        showMessage('An error occurred during login', 'error');
    } finally {
        setButtonLoading(loginBtn, false);
        isLoginInProgress = false; // Unlock
    }
}

// 2FA Verification - UPDATED WITH DUPLICATE PREVENTION
async function handle2FAVerification() {
    // Prevent duplicate requests
    if (is2FAVerificationInProgress) {
        console.log('⚠️ 2FA verification already in progress, ignoring duplicate request');
        return;
    }
    
    clearErrors();
    
    const code = document.getElementById('twoFACode').value.trim();
    
    if (!code || code.length !== 6) {
        showError('twoFAError', 'Please enter a valid 6-digit code');
        return;
    }

    const verify2FABtn = document.getElementById('verify2FABtn');
    setButtonLoading(verify2FABtn, true);
    is2FAVerificationInProgress = true; // Lock to prevent duplicates

    try {
        console.log('🔄 Verifying 2FA code...');
        const result = await apiCall('/verify-2fa', 'POST', {
            email: currentEmail,
            otp: code
        });

        console.log('📡 2FA Verification Response:', result);

        if (result.success) {
            stopTimer(twoFATimerInterval);
            showMessage('2FA verification successful!', 'success');
            
            // Store user info and token
            if (result.data.user) {
                sessionStorage.setItem('currentUser', result.data.user.username);
                sessionStorage.setItem('userEmail', result.data.user.email);
                sessionStorage.setItem('userId', result.data.user.id);
            }
            if (result.data.token) {
                localStorage.setItem('token', result.data.token);
            }
            
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            showError('twoFAError', result.data.message || 'Invalid 2FA code');
        }
    } catch (error) {
        console.error('💥 2FA verification error:', error);
        showMessage('Error verifying 2FA code', 'error');
    } finally {
        setButtonLoading(verify2FABtn, false);
        is2FAVerificationInProgress = false; // Unlock
    }
}

// Resend 2FA Code
async function resend2FACode() {
    try {
        console.log('Resending 2FA code...');
        const result = await apiCall('/send-2fa-otp', 'POST', {
            email: currentEmail
        });

        console.log('Resend 2FA Response:', result);

        if (result.success) {
            showError('twoFAError', '');
            
            // Reset timer
            stopTimer(twoFATimerInterval);
            twoFATimerInterval = startTimer(document.getElementById('twoFATimer'), 5, () => {
                showError('twoFAError', '2FA code has expired. Please request a new one.');
            });
            
            showMessage('New 2FA code sent to your email', 'success');
        } else {
            showError('twoFAError', result.data.message || 'Failed to resend code');
        }
    } catch (error) {
        console.error('Resend 2FA error:', error);
        showMessage('Failed to resend 2FA code', 'error');
    }
}

// Back from 2FA
function backFrom2FA() {
    stopTimer(twoFATimerInterval);
    showLoginForm();
    document.getElementById('twoFACode').value = '';
    document.getElementById('twoFAError').textContent = '';
}

// Signup Functionality
async function handleSignup() {
    clearErrors();
    
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    let hasError = false;
    
    // Validate username
    if (!username) {
        showError('usernameError', 'Username is required');
        hasError = true;
    } else if (username.length < 3) {
        showError('usernameError', 'Username must be at least 3 characters');
        hasError = true;
    }
    
    // Validate email
    if (!email) {
        showError('emailError', 'Email is required');
        hasError = true;
    } else if (!isValidEmail(email)) {
        showError('emailError', 'Please enter a valid email address');
        hasError = true;
    }
    
    // Validate password with detailed feedback
    if (!password) {
        showError('passwordError', 'Password is required');
        hasError = true;
    } else if (!isValidPassword(password)) {
        const { feedback } = getPasswordStrength(password);
        showError('passwordError', `Password must contain: ${feedback.join(', ')}`);
        hasError = true;
    }
    
    // Validate confirm password
    if (!confirmPassword) {
        showError('confirmPasswordError', 'Please confirm your password');
        hasError = true;
    } else if (password !== confirmPassword) {
        showError('confirmPasswordError', 'Passwords do not match');
        hasError = true;
    }
    
    if (hasError) return;

    const signupBtn = document.getElementById('signupBtn');
    setButtonLoading(signupBtn, true);

    try {
        const result = await apiCall('/signup', 'POST', {
            username,
            email,
            password
        });

        if (result.success) {
            showMessage('Account created successfully! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            // Handle backend validation errors
            if (result.data.message && result.data.message.includes('username')) {
                showError('usernameError', result.data.message);
            } else if (result.data.message && result.data.message.includes('email')) {
                showError('emailError', result.data.message);
            } else {
                showMessage(result.data.message || 'Signup failed!', 'error');
            }
        }
    } catch (error) {
        showMessage('An error occurred during signup', 'error');
    } finally {
        setButtonLoading(signupBtn, false);
    }
}

// Forgot Password Functionality
let otpData = null;

async function sendOTP() {
    clearErrors();
    
    const email = document.getElementById('forgotEmail').value.trim();
    
    if (!email) {
        showError('forgotEmailError', 'Email is required');
        return;
    }
    
    if (!isValidEmail(email)) {
        showError('forgotEmailError', 'Please enter a valid email address');
        return;
    }

    const sendOTPBtn = document.getElementById('sendOTPBtn');
    setButtonLoading(sendOTPBtn, true);

    try {
        // Call backend to send OTP
        const result = await apiCall('/forgot-password', 'POST', { email });

        if (result.success) {
            // Store OTP data temporarily
            otpData = {
                email: email,
                expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes
            };
            
            showMessage(`OTP sent to ${email}`, 'success');
            showOTPVerification();
            startOTPTimer();
            
            // Show demo OTP in development
            if (result.data.demoOTP) {
                console.log('Demo OTP:', result.data.demoOTP);
            }
        } else {
            showMessage(result.data.message || 'Failed to send OTP', 'error');
        }
    } catch (error) {
        showMessage('Failed to send OTP', 'error');
    } finally {
        setButtonLoading(sendOTPBtn, false);
    }
}

function startOTPTimer() {
    let timeLeft = 300; // 5 minutes in seconds
    
    if (otpTimerInterval) {
        clearInterval(otpTimerInterval);
    }
    
    otpTimerInterval = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(otpTimerInterval);
            document.getElementById('otpTimer').textContent = '0:00';
            showMessage('OTP expired. Please request a new one.', 'error');
            showForgotPassword();
            return;
        }
        
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('otpTimer').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        timeLeft--;
    }, 1000);
}

function resendOTP() {
    if (otpData) {
        const email = otpData.email;
        document.getElementById('forgotEmail').value = email;
        clearInterval(otpTimerInterval);
        sendOTP();
    }
}

async function verifyOTP() {
    clearErrors();
    
    const enteredOTP = document.getElementById('otpCode').value.trim();
    
    if (!enteredOTP) {
        showError('otpError', 'Please enter the OTP');
        return;
    }
    
    if (enteredOTP.length !== 6) {
        showError('otpError', 'OTP must be 6 digits');
        return;
    }

    const verifyOTPBtn = document.getElementById('verifyOTPBtn');
    setButtonLoading(verifyOTPBtn, true);

    try {
        // Call backend to verify OTP
        const result = await apiCall('/verify-otp', 'POST', {
            email: otpData.email,
            otp: enteredOTP
        });

        if (result.success) {
            clearInterval(otpTimerInterval);
            // Store the resetToken for the password reset
            otpData.resetToken = result.data.resetToken;
            showResetPassword();
        } else {
            showError('otpError', result.data.message || 'Invalid OTP');
        }
    } catch (error) {
        showMessage('Error verifying OTP', 'error');
    } finally {
        setButtonLoading(verifyOTPBtn, false);
    }
}

async function resetPassword() {
    clearErrors();
    
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    
    if (!newPassword) {
        showError('newPasswordError', 'Password is required');
        return;
    }
    
    if (!isValidPassword(newPassword)) {
        const { feedback } = getPasswordStrength(newPassword);
        showError('newPasswordError', `Password must contain: ${feedback.join(', ')}`);
        return;
    }
    
    if (!confirmNewPassword) {
        showError('confirmNewPasswordError', 'Please confirm your password');
        return;
    }
    
    if (newPassword !== confirmNewPassword) {
        showError('confirmNewPasswordError', 'Passwords do not match');
        return;
    }
    
    if (!otpData || !otpData.resetToken) {
        showMessage('Session expired. Please try again.', 'error');
        showForgotPassword();
        return;
    }

    const resetBtn = document.getElementById('resetPasswordBtn');
    setButtonLoading(resetBtn, true);

    try {
        const result = await apiCall('/reset-password', 'POST', {
            email: otpData.email,
            resetToken: otpData.resetToken,
            newPassword: newPassword
        });

        if (result.success) {
            showMessage('Password reset successfully! Please login with your new password.', 'success');
            otpData = null;
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showMessage(result.data.message || 'Password reset failed', 'error');
        }
    } catch (error) {
        showMessage('An error occurred during password reset', 'error');
    } finally {
        setButtonLoading(resetBtn, false);
    }
}

// Debug function to test 2FA
async function test2FAFlow() {
    console.log('Testing 2FA flow...');
    
    // First, let's check if we can enable 2FA for a user
    const testResult = await apiCall('/login', 'POST', {
        identifier: 'test@test.com',
        password: 'Test123!'
    });
    
    console.log('Test login result:', testResult);
    
    if (testResult.success && testResult.data.token) {
        // Try to enable 2FA
        const enable2FAResult = await apiCall('/enable-2fa', 'POST', {}, {
            'Authorization': `Bearer ${testResult.data.token}`
        });
        
        console.log('Enable 2FA result:', enable2FAResult);
    }
}

// Event Listeners Initialization
function initializeEventListeners() {
    // SIGNUP PAGE
    const signupBtn = document.getElementById('signupBtn');
    if (signupBtn) {
        signupBtn.addEventListener('click', handleSignup);
    }
    
    // Password strength real-time validation
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.addEventListener('input', function(e) {
            updatePasswordStrengthIndicator(e.target.value);
        });
        
        passwordInput.addEventListener('focus', function() {
            const requirements = document.getElementById('passwordRequirements');
            if (requirements) {
                requirements.style.display = 'block';
            }
        });
        
        passwordInput.addEventListener('blur', function() {
            // Hide requirements after a delay if not focused on related elements
            setTimeout(() => {
                const requirements = document.getElementById('passwordRequirements');
                const isFocused = document.activeElement === passwordInput || 
                                document.activeElement === document.getElementById('confirmPassword');
                if (requirements && !isFocused) {
                    requirements.style.display = 'none';
                }
            }, 200);
        });
    }
    
    const confirmPassword = document.getElementById('confirmPassword');
    if (confirmPassword) {
        confirmPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleSignup();
        });
        
        confirmPassword.addEventListener('focus', function() {
            const requirements = document.getElementById('passwordRequirements');
            if (requirements) {
                requirements.style.display = 'block';
            }
        });
    }

    // LOGIN PAGE - 2FA Support
    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleLogin);
    }
    
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // 2FA Elements
    const verify2FABtn = document.getElementById('verify2FABtn');
    if (verify2FABtn) {
        verify2FABtn.addEventListener('click', handle2FAVerification);
    }

    const resend2FALink = document.getElementById('resend2FALink');
    if (resend2FALink) {
        resend2FALink.addEventListener('click', function(e) {
            e.preventDefault();
            resend2FACode();
        });
    }

    const backFrom2FABtn = document.getElementById('backFrom2FABtn');
    if (backFrom2FABtn) {
        backFrom2FABtn.addEventListener('click', backFrom2FA);
    }

    const twoFACode = document.getElementById('twoFACode');
    if (twoFACode) {
        twoFACode.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') handle2FAVerification();
        });
        
        // Only allow numbers
        twoFACode.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    // FORGOT PASSWORD FLOW
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            showForgotPassword();
        });
    }

    const backToLoginBtn = document.getElementById('backToLoginBtn');
    if (backToLoginBtn) {
        backToLoginBtn.addEventListener('click', showLoginForm);
    }

    const sendOTPBtn = document.getElementById('sendOTPBtn');
    if (sendOTPBtn) {
        sendOTPBtn.addEventListener('click', sendOTP);
    }

    const backFromOTPBtn = document.getElementById('backFromOTPBtn');
    if (backFromOTPBtn) {
        backFromOTPBtn.addEventListener('click', showForgotPassword);
    }

    const resendOTPLink = document.getElementById('resendOTPLink');
    if (resendOTPLink) {
        resendOTPLink.addEventListener('click', function(e) {
            e.preventDefault();
            resendOTP();
        });
    }

    const verifyOTPBtn = document.getElementById('verifyOTPBtn');
    if (verifyOTPBtn) {
        verifyOTPBtn.addEventListener('click', verifyOTP);
    }

    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', resetPassword);
    }

    // OTP input validation
    const otpCode = document.getElementById('otpCode');
    if (otpCode) {
        otpCode.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') verifyOTP();
        });
        
        // Only allow numbers
        otpCode.addEventListener('input', function(e) {
            this.value = this.value.replace(/[^0-9]/g, '');
        });
    }

    // Enter key handlers for all forms
    const textInputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    textInputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (document.getElementById('loginForm') && !document.getElementById('loginForm').classList.contains('hidden')) {
                    handleLogin();
                } else if (document.getElementById('signupForm')) {
                    handleSignup();
                } else if (document.getElementById('twoFactorForm') && !document.getElementById('twoFactorForm').classList.contains('hidden')) {
                    handle2FAVerification();
                } else if (document.getElementById('forgotPasswordForm') && !document.getElementById('forgotPasswordForm').classList.contains('hidden')) {
                    sendOTP();
                } else if (document.getElementById('otpVerificationForm') && !document.getElementById('otpVerificationForm').classList.contains('hidden')) {
                    verifyOTP();
                } else if (document.getElementById('resetPasswordForm') && !document.getElementById('resetPasswordForm').classList.contains('hidden')) {
                    resetPassword();
                }
            }
        });
    });

    console.log('Auth event listeners initialized successfully');
}

// Check authentication status
async function checkAuthStatus() {
    try {
        const result = await apiCall('/me');
        if (result.success && (window.location.pathname.includes('login.html') || window.location.pathname.includes('signup.html'))) {
            // User is already logged in, redirect to main page
            window.location.href = 'index.html';
        }
    } catch (error) {
        // Not logged in or error, continue normally
    }
}

// Logout function (for use in other pages)
async function handleLogout() {
    try {
        await apiCall('/logout', 'POST');
        sessionStorage.clear();
        localStorage.removeItem('adminInfo');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Logout error:', error);
        // Force logout anyway
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    checkAuthStatus();
    
    // Add debug function to window for testing
    window.test2FAFlow = test2FAFlow;
    console.log('Auth.js loaded. Use test2FAFlow() in console to test 2FA.');
});