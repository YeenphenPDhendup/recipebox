const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { protect } = require('../middleware/auth');
const { body } = require('express-validator');

// All recipe routes require authentication
router.use(protect);

// Enhanced Validation with Sanitization
const recipeValidation = [
    body('name')
        .trim()
        .escape()
        .isLength({ min: 3, max: 100 })
        .withMessage('Recipe name must be 3-100 characters'),
    
    body('description')
        .trim()
        .escape()
        .isLength({ min: 10, max: 500 })
        .withMessage('Description must be 10-500 characters'),
    
    body('servings')
        .toInt()
        .isInt({ min: 1, max: 100 })
        .withMessage('Servings must be between 1 and 100'),
    
    body('prepTime')
        .toInt()
        .isInt({ min: 1, max: 1440 })
        .withMessage('Prep time must be between 1 and 1440 minutes'),
    
    body('ingredients')
        .isArray({ min: 1 })
        .withMessage('At least one ingredient is required'),
    
    body('steps')
        .isArray({ min: 1 })
        .withMessage('At least one step is required'),
    
    // Sanitize array elements
    body('ingredients.*')
        .trim()
        .escape()
        .isLength({ min: 1, max: 200 })
        .withMessage('Each ingredient must be 1-200 characters'),
    
    body('steps.*')
        .trim()
        .escape()
        .isLength({ min: 5, max: 1000 })
        .withMessage('Each step must be 5-1000 characters')
];

// Routes
router.get('/', recipeController.getMyRecipes);
router.post('/', recipeValidation, recipeController.createRecipe);
router.get('/:id', recipeController.getRecipe);
router.put('/:id', recipeValidation, recipeController.updateRecipe);
router.delete('/:id', recipeController.deleteRecipe);

module.exports = router;