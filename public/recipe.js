// API Configuration
const API_BASE_URL = '/api/recipes';

// Check authentication
let currentUser = sessionStorage.getItem('currentUser');
let currentUserId = sessionStorage.getItem('userId');

if (!currentUser || !currentUserId) {
    window.location.href = 'login.html';
}

// Initialize
let recipes = [];
let editingRecipeId = null;
let ingredients = [''];
let steps = [''];
let currentImageData = '';

// API Helper Function
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include'
    };

    if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data);
    }

    try {
        console.log(`Making API call to: ${endpoint}`, data);
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

// Initialize DOM elements and event listeners
function initializeRecipeApp() {
    // Display username
    const usernameElement = document.getElementById('username');
    if (usernameElement) {
        usernameElement.textContent = currentUser;
    }

    // Initialize event listeners
    initializeEventListeners();
    
    // Load recipes from database
    loadRecipes();
}

// Event Listeners Initialization
function initializeEventListeners() {
    // Header buttons
    const addRecipeBtn = document.getElementById('addRecipeBtn');
    if (addRecipeBtn) {
        addRecipeBtn.addEventListener('click', showAddRecipeForm);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Form buttons
    const closeFormBtn = document.getElementById('closeFormBtn');
    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', closeRecipeForm);
    }

    const addIngredientBtn = document.getElementById('addIngredientBtn');
    if (addIngredientBtn) {
        addIngredientBtn.addEventListener('click', addIngredient);
    }

    const addStepBtn = document.getElementById('addStepBtn');
    if (addStepBtn) {
        addStepBtn.addEventListener('click', addStep);
    }

    const saveRecipeBtn = document.getElementById('saveRecipeBtn');
    if (saveRecipeBtn) {
        saveRecipeBtn.addEventListener('click', saveRecipe);
    }

    const cancelFormBtn = document.getElementById('cancelFormBtn');
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', closeRecipeForm);
    }

    // Empty state button
    const addFirstRecipeBtn = document.getElementById('addFirstRecipeBtn');
    if (addFirstRecipeBtn) {
        addFirstRecipeBtn.addEventListener('click', showAddRecipeForm);
    }

    // Image preview
    const recipeImage = document.getElementById('recipeImage');
    if (recipeImage) {
        recipeImage.addEventListener('change', handleImagePreview);
    }

    console.log('Recipe event listeners initialized successfully');
}

// Image preview handler
function handleImagePreview(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('imagePreview');
    
    if (file) {
        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            event.target.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            currentImageData = e.target.result;
            if (preview) {
                preview.innerHTML = `<img src="${currentImageData}" alt="Preview">`;
                preview.classList.remove('hidden');
            }
        };
        reader.readAsDataURL(file);
    } else {
        if (preview) {
            preview.innerHTML = '';
            preview.classList.add('hidden');
        }
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeRecipeApp);

// Logout function
async function logout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            sessionStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// Recipe Management Functions
async function loadRecipes() {
    try {
        console.log('Loading recipes from API...');
        const result = await apiCall('/');
        
        if (result.success) {
            recipes = result.data.data || [];
            console.log(`Loaded ${recipes.length} recipes`);
            renderRecipes();
        } else {
            console.error('Error loading recipes:', result.data);
            // Show empty state if no recipes or error
            renderRecipes();
        }
    } catch (error) {
        console.error('Error loading recipes:', error);
        renderRecipes();
    }
}

function renderRecipes() {
    const recipesList = document.getElementById('recipesList');
    const emptyState = document.getElementById('emptyState');

    if (!recipesList || !emptyState) return;

    if (recipes.length === 0) {
        recipesList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    
    recipesList.innerHTML = '<div class="recipes-grid">' + recipes.map(recipe => `
        <div class="recipe-card">
            ${recipe.image ? `<img src="${recipe.image}" alt="${recipe.name}" class="recipe-image">` : ''}
            <div class="recipe-content">
                <h3 class="recipe-title">${recipe.name}</h3>
                <p class="recipe-description">${recipe.description}</p>
                <div class="recipe-meta">
                    <div class="meta-item">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                        </svg>
                        ${recipe.servings} servings
                    </div>
                    <div class="meta-item">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        ${recipe.prepTime} min
                    </div>
                </div>
                <div class="ingredients-preview">
                    <h4>Ingredients:</h4>
                    <ul>
                        ${recipe.ingredients.slice(0, 3).map(ing => `<li>• ${ing}</li>`).join('')}
                        ${recipe.ingredients.length > 3 ? `<li class="more-ingredients">+ ${recipe.ingredients.length - 3} more</li>` : ''}
                    </ul>
                </div>
                <div class="recipe-actions">
                    <button class="btn btn-edit" data-recipe-id="${recipe._id}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Edit
                    </button>
                    <button class="btn btn-delete" data-recipe-id="${recipe._id}">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        </div>
    `).join('') + '</div>';

    // Add event listeners to dynamically created buttons
    addRecipeEventListeners();
}

// Add event listeners to dynamically created recipe buttons
function addRecipeEventListeners() {
    // Edit buttons
    const editButtons = document.querySelectorAll('.btn-edit');
    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const recipeId = this.getAttribute('data-recipe-id');
            editRecipe(recipeId);
        });
    });

    // Delete buttons
    const deleteButtons = document.querySelectorAll('.btn-delete');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const recipeId = this.getAttribute('data-recipe-id');
            deleteRecipe(recipeId);
        });
    });
}

// Form Functions
function showAddRecipeForm() {
    editingRecipeId = null;
    ingredients = [''];
    steps = [''];
    currentImageData = '';
    
    const formTitle = document.getElementById('formTitle');
    const saveBtnText = document.getElementById('saveBtnText');
    const recipeName = document.getElementById('recipeName');
    const recipeDescription = document.getElementById('recipeDescription');
    const recipeServings = document.getElementById('recipeServings');
    const recipePrepTime = document.getElementById('recipePrepTime');
    const recipeImage = document.getElementById('recipeImage');
    const imagePreview = document.getElementById('imagePreview');
    const addRecipeBtn = document.getElementById('addRecipeBtn');
    const recipeForm = document.getElementById('recipeForm');

    if (formTitle) formTitle.textContent = 'Add New Recipe';
    if (saveBtnText) saveBtnText.textContent = 'Save Recipe';
    if (recipeName) recipeName.value = '';
    if (recipeDescription) recipeDescription.value = '';
    if (recipeServings) recipeServings.value = '';
    if (recipePrepTime) recipePrepTime.value = '';
    if (recipeImage) recipeImage.value = '';
    if (imagePreview) {
        imagePreview.innerHTML = '';
        imagePreview.classList.add('hidden');
    }
    if (addRecipeBtn) addRecipeBtn.classList.add('hidden');
    if (recipeForm) recipeForm.classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderIngredients();
    renderSteps();
}

function closeRecipeForm() {
    const recipeForm = document.getElementById('recipeForm');
    const addRecipeBtn = document.getElementById('addRecipeBtn');
    
    if (recipeForm) recipeForm.classList.add('hidden');
    if (addRecipeBtn) addRecipeBtn.classList.remove('hidden');
    editingRecipeId = null;
}

// Ingredients Management
function renderIngredients() {
    const ingredientsList = document.getElementById('ingredientsList');
    if (!ingredientsList) return;

    ingredientsList.innerHTML = ingredients.map((ing, index) => `
        <div class="array-item">
            <input type="text" value="${ing}" placeholder="Ingredient ${index + 1}" style="flex: 1;" data-ingredient-index="${index}">
            ${ingredients.length > 1 ? `
                <button class="delete-btn" data-remove-ingredient="${index}">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            ` : ''}
        </div>
    `).join('');

    // Add event listeners to ingredient inputs and delete buttons
    const ingredientInputs = ingredientsList.querySelectorAll('input[data-ingredient-index]');
    ingredientInputs.forEach(input => {
        input.addEventListener('input', function() {
            const index = parseInt(this.getAttribute('data-ingredient-index'));
            updateIngredient(index, this.value);
        });
    });

    const removeIngredientButtons = ingredientsList.querySelectorAll('[data-remove-ingredient]');
    removeIngredientButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-remove-ingredient'));
            removeIngredient(index);
        });
    });
}

function addIngredient() {
    ingredients.push('');
    renderIngredients();
}

function updateIngredient(index, value) {
    ingredients[index] = value;
}

function removeIngredient(index) {
    if (ingredients.length > 1) {
        ingredients.splice(index, 1);
        renderIngredients();
    }
}

// Steps Management
function renderSteps() {
    const stepsList = document.getElementById('stepsList');
    if (!stepsList) return;

    stepsList.innerHTML = steps.map((step, index) => `
        <div class="array-item">
            <div class="step-number">${index + 1}</div>
            <textarea placeholder="Step ${index + 1}" style="flex: 1;" rows="2" data-step-index="${index}">${step}</textarea>
            ${steps.length > 1 ? `
                <button class="delete-btn" data-remove-step="${index}">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            ` : ''}
        </div>
    `).join('');

    // Add event listeners to step textareas and delete buttons
    const stepTextareas = stepsList.querySelectorAll('textarea[data-step-index]');
    stepTextareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            const index = parseInt(this.getAttribute('data-step-index'));
            updateStep(index, this.value);
        });
    });

    const removeStepButtons = stepsList.querySelectorAll('[data-remove-step]');
    removeStepButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-remove-step'));
            removeStep(index);
        });
    });
}

function addStep() {
    steps.push('');
    renderSteps();
}

function updateStep(index, value) {
    steps[index] = value;
}

function removeStep(index) {
    if (steps.length > 1) {
        steps.splice(index, 1);
        renderSteps();
    }
}

// Save Recipe
async function saveRecipe() {
    const name = document.getElementById('recipeName')?.value.trim();
    const description = document.getElementById('recipeDescription')?.value.trim();
    const servings = document.getElementById('recipeServings')?.value;
    const prepTime = document.getElementById('recipePrepTime')?.value;

    if (!name || !description || !servings || !prepTime) {
        alert('Please fill in all required fields');
        return;
    }

    const filteredIngredients = ingredients.filter(i => i.trim());
    const filteredSteps = steps.filter(s => s.trim());

    if (filteredIngredients.length === 0) {
        alert('Please add at least one ingredient');
        return;
    }

    if (filteredSteps.length === 0) {
        alert('Please add at least one step');
        return;
    }

    const recipeData = {
        name,
        description,
        image: currentImageData,
        servings: parseInt(servings),
        prepTime: parseInt(prepTime),
        ingredients: filteredIngredients,
        steps: filteredSteps
    };

    console.log('Saving recipe:', recipeData);

    try {
        let result;
        if (editingRecipeId) {
            // Update existing recipe
            result = await apiCall(`/${editingRecipeId}`, 'PUT', recipeData);
        } else {
            // Create new recipe
            result = await apiCall('/', 'POST', recipeData);
        }

        if (result.success) {
            alert(editingRecipeId ? 'Recipe updated successfully!' : 'Recipe added successfully!');
            await loadRecipes(); // Reload recipes from database
            closeRecipeForm();
        } else {
            alert('Error saving recipe: ' + (result.data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving recipe:', error);
        alert('Error saving recipe. Please try again.');
    }
}

// Edit Recipe
async function editRecipe(id) {
    try {
        console.log('Editing recipe:', id);
        const result = await apiCall(`/${id}`);
        
        if (result.success) {
            const recipe = result.data.data;
            
            editingRecipeId = id;
            
            const formTitle = document.getElementById('formTitle');
            const saveBtnText = document.getElementById('saveBtnText');
            const recipeName = document.getElementById('recipeName');
            const recipeDescription = document.getElementById('recipeDescription');
            const recipeServings = document.getElementById('recipeServings');
            const recipePrepTime = document.getElementById('recipePrepTime');
            const addRecipeBtn = document.getElementById('addRecipeBtn');
            const recipeForm = document.getElementById('recipeForm');

            if (formTitle) formTitle.textContent = 'Edit Recipe';
            if (saveBtnText) saveBtnText.textContent = 'Update Recipe';
            if (recipeName) recipeName.value = recipe.name;
            if (recipeDescription) recipeDescription.value = recipe.description;
            if (recipeServings) recipeServings.value = recipe.servings;
            if (recipePrepTime) recipePrepTime.value = recipe.prepTime;
            
            currentImageData = recipe.image || '';
            if (currentImageData) {
                const preview = document.getElementById('imagePreview');
                if (preview) {
                    preview.innerHTML = `<img src="${currentImageData}" alt="Preview">`;
                    preview.classList.remove('hidden');
                }
            }

            ingredients = [...recipe.ingredients];
            steps = [...recipe.steps];

            if (addRecipeBtn) addRecipeBtn.classList.add('hidden');
            if (recipeForm) recipeForm.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
            renderIngredients();
            renderSteps();
        } else {
            alert('Error loading recipe: ' + (result.data.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error loading recipe:', error);
        alert('Error loading recipe. Please try again.');
    }
}

// Delete Recipe
async function deleteRecipe(id) {
    if (confirm('Are you sure you want to delete this recipe? This action cannot be undone.')) {
        try {
            const result = await apiCall(`/${id}`, 'DELETE');
            
            if (result.success) {
                alert('Recipe deleted successfully!');
                await loadRecipes(); // Reload recipes from database
            } else {
                alert('Error deleting recipe: ' + (result.data.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting recipe:', error);
            alert('Error deleting recipe. Please try again.');
        }
    }
}