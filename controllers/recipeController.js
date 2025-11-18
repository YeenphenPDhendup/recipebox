const Recipe = require('../models/Recipe');
const logger = require('../config/logger');
const { validationResult } = require('express-validator');

// @desc    Get all user's recipes
// @route   GET /api/recipes
// @access  Private
exports.getMyRecipes = async (req, res) => {
    try {
        const recipes = await Recipe.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: recipes.length,
            data: recipes
        });

    } catch (error) {
        logger.error('Get recipes error', { error: error.message, userId: req.user._id });
        res.status(500).json({
            success: false,
            message: 'Error fetching recipes'
        });
    }
};

// @desc    Create recipe
// @route   POST /api/recipes
// @access  Private
exports.createRecipe = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg
            });
        }

        const recipe = await Recipe.create({
            ...req.body,
            userId: req.user._id
        });

        logger.info('Recipe created', {
            recipeId: recipe._id,
            userId: req.user._id,
            recipeName: recipe.name
        });

        res.status(201).json({
            success: true,
            message: 'Recipe created successfully',
            data: recipe
        });

    } catch (error) {
        logger.error('Create recipe error', { error: error.message, userId: req.user._id });
        res.status(500).json({
            success: false,
            message: 'Error creating recipe'
        });
    }
};

// @desc    Get single recipe
// @route   GET /api/recipes/:id
// @access  Private
exports.getRecipe = async (req, res) => {
    try {
        const recipe = await Recipe.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }

        res.status(200).json({
            success: true,
            data: recipe
        });

    } catch (error) {
        logger.error('Get recipe error', { error: error.message, recipeId: req.params.id });
        res.status(500).json({
            success: false,
            message: 'Error fetching recipe'
        });
    }
};

// @desc    Update recipe
// @route   PUT /api/recipes/:id
// @access  Private
exports.updateRecipe = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: errors.array()[0].msg
            });
        }

        const recipe = await Recipe.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }

        Object.assign(recipe, req.body);
        await recipe.save();

        logger.info('Recipe updated', {
            recipeId: recipe._id,
            userId: req.user._id
        });

        res.status(200).json({
            success: true,
            message: 'Recipe updated successfully',
            data: recipe
        });

    } catch (error) {
        logger.error('Update recipe error', { error: error.message, recipeId: req.params.id });
        res.status(500).json({
            success: false,
            message: 'Error updating recipe'
        });
    }
};

// @desc    Delete recipe
// @route   DELETE /api/recipes/:id
// @access  Private
exports.deleteRecipe = async (req, res) => {
    try {
        const recipe = await Recipe.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!recipe) {
            return res.status(404).json({
                success: false,
                message: 'Recipe not found'
            });
        }

        await Recipe.findByIdAndDelete(req.params.id);

        logger.info('Recipe deleted', {
            recipeId: req.params.id,
            userId: req.user._id
        });

        res.status(200).json({
            success: true,
            message: 'Recipe deleted successfully'
        });

    } catch (error) {
        logger.error('Delete recipe error', { error: error.message, recipeId: req.params.id });
        res.status(500).json({
            success: false,
            message: 'Error deleting recipe'
        });
    }
};