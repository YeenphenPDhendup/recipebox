const mongoose = require('mongoose');

const recipeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: [true, 'Recipe name is required'],
        trim: true,
        minlength: [3, 'Recipe name must be at least 3 characters'],
        maxlength: [100, 'Recipe name must not exceed 100 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        maxlength: [500, 'Description must not exceed 500 characters']
    },
    image: {
        type: String,
        default: null
    },
    servings: {
        type: Number,
        required: [true, 'Servings is required'],
        min: [1, 'Servings must be at least 1'],
        max: [100, 'Servings must not exceed 100']
    },
    prepTime: {
        type: Number,
        required: [true, 'Preparation time is required'],
        min: [1, 'Prep time must be at least 1 minute'],
        max: [1440, 'Prep time must not exceed 24 hours']
    },
    ingredients: [{
        type: String,
        required: true,
        trim: true,
        maxlength: [200, 'Ingredient must not exceed 200 characters']
    }],
    steps: [{
        type: String,
        required: true,
        trim: true,
        maxlength: [500, 'Step must not exceed 500 characters']
    }],
    isPublic: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
recipeSchema.index({ userId: 1, createdAt: -1 });
recipeSchema.index({ name: 'text', description: 'text' });

// Validation: At least one ingredient
recipeSchema.path('ingredients').validate(function(value) {
    return value && value.length > 0;
}, 'At least one ingredient is required');

// Validation: At least one step
recipeSchema.path('steps').validate(function(value) {
    return value && value.length > 0;
}, 'At least one step is required');

const Recipe = mongoose.model('Recipe', recipeSchema);

module.exports = Recipe;