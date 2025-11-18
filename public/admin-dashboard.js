const API_URL = '/api/admin';

// Check admin authentication
const adminToken = localStorage.getItem('adminToken');
const adminInfo = JSON.parse(localStorage.getItem('adminInfo') || '{}');

if (!adminToken) {
    window.location.href = 'admin-login.html';
}

// Pagination state
let currentPage = 1;
let totalPages = 1;

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    initializeAdminDashboard();
});

// Initialize dashboard with event listeners
function initializeAdminDashboard() {
    // Display admin username
    const adminUsernameElement = document.getElementById('adminUsername');
    if (adminUsernameElement) {
        adminUsernameElement.textContent = adminInfo.username || 'Admin';
    }

    // Initialize event listeners
    initializeEventListeners();
    
    // Load dashboard data
    loadDashboardStats();
    loadUsers();
}

// Initialize event listeners
function initializeEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('adminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', adminLogout);
    }

    // Search button
    const searchBtn = document.getElementById('searchUsersBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchUsers);
    }

    // Pagination buttons
    const prevBtn = document.getElementById('prevBtn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => changePage(-1));
    }

    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => changePage(1));
    }

    // Search input (Enter key)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchUsers();
            }
        });
    }

    console.log('Admin dashboard event listeners initialized');
}

// Get auth headers
function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
    };
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await fetch(`${API_URL}/dashboard`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            throw new Error('Failed to load stats');
        }
        
        const { data } = await response.json();
        
        const totalUsersElement = document.getElementById('totalUsers');
        const activeUsersElement = document.getElementById('activeUsers');
        const totalRecipesElement = document.getElementById('totalRecipes');
        const newUsersTodayElement = document.getElementById('newUsersToday');
        
        if (totalUsersElement) totalUsersElement.textContent = data.totalUsers + (data.totalInactiveUsers || 0);
        if (activeUsersElement) activeUsersElement.textContent = data.totalUsers;
        if (totalRecipesElement) totalRecipesElement.textContent = data.totalRecipes;
        if (newUsersTodayElement) newUsersTodayElement.textContent = data.usersToday || 0;
        
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load users with pagination
async function loadUsers(page = 1, search = '') {
    try {
        let url = `${API_URL}/users?page=${page}&limit=10`;
        if (search) {
            url += `&search=${encodeURIComponent(search)}`;
        }
        
        const response = await fetch(url, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            throw new Error('Failed to load users');
        }
        
        const { data } = await response.json();
        
        currentPage = data.pagination.currentPage;
        totalPages = data.pagination.totalPages;
        
        renderUsers(data.users);
        updatePagination();
        
    } catch (error) {
        console.error('Error loading users:', error);
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #ef4444;">
                        Error loading users. Please refresh the page.
                    </td>
                </tr>
            `;
        }
    }
}

// Render users in table
function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #6b7280; padding: 40px;">
                    No users found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr>
            <td>
                <div class="user-info">
                    <div class="user-avatar">${user.username?.charAt(0)?.toUpperCase() || 'U'}</div>
                    <div>
                        <div style="font-weight: 600; color: #1f2937;">${user.username || 'Unknown'}</div>
                        <div style="font-size: 12px; color: #6b7280;">ID: ${user._id ? user._id.slice(-8) : 'N/A'}</div>
                    </div>
                </div>
            </td>
            <td>${user.email || 'No email'}</td>
            <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown'}</td>
            <td>${user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</td>
            <td>
                <span class="status-badge ${user.isActive ? 'active' : 'inactive'}">
                    ${user.isActive ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-danger btn-sm delete-user-btn" data-user-id="${user._id}" data-username="${user.username || 'Unknown'}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 14px; height: 14px;">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Add event listeners to delete buttons
    addDeleteButtonListeners();
}

// Add event listeners to dynamically created delete buttons
function addDeleteButtonListeners() {
    const deleteButtons = document.querySelectorAll('.delete-user-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const userId = this.getAttribute('data-user-id');
            const username = this.getAttribute('data-username');
            deleteUser(userId, username);
        });
    });
}

// Update pagination controls
function updatePagination() {
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
}

// Change page
function changePage(direction) {
    const newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        const searchInput = document.getElementById('searchInput');
        const search = searchInput ? searchInput.value.trim() : '';
        loadUsers(newPage, search);
    }
}

// Search users
function searchUsers() {
    const searchInput = document.getElementById('searchInput');
    const search = searchInput ? searchInput.value.trim() : '';
    loadUsers(1, search);
}

// Delete user
async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?\n\nThis will also delete all their recipes. This action cannot be undone.`)) {
        return;
    }
    
    const confirmDelete = prompt(`Type "${username}" to confirm deletion:`);
    if (confirmDelete !== username) {
        alert('Deletion cancelled. Username did not match.');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                handleUnauthorized();
                return;
            }
            throw new Error('Failed to delete user');
        }
        
        const data = await response.json();
        alert(data.message || 'User deleted successfully');
        
        // Reload users and stats
        loadDashboardStats();
        loadUsers(currentPage);
        
    } catch (error) {
        console.error('Error deleting user:', error);
        alert('Error deleting user. Please try again.');
    }
}

// Admin logout
async function adminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            // Call backend logout endpoint if it exists
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout API call failed:', error);
            // Continue with client-side logout anyway
        } finally {
            // Clear all admin data
            localStorage.removeItem('adminToken');
            localStorage.removeItem('adminInfo');
            sessionStorage.clear();
            
            // Redirect to admin login
            window.location.href = 'admin-login.html';
        }
    }
}

// Handle unauthorized access
function handleUnauthorized() {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    alert('Your session has expired. Please login again.');
    window.location.href = 'admin-login.html';
}