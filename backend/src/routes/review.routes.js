const express = require('express');
const { addReview, getReviews } = require('../controllers/review.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');

const router = express.Router({ mergeParams: true }); // Important to access :id from parent router

const reviewRules = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().escape(),
];

router.get('/', getReviews);
router.post('/', authenticate, reviewRules, validate, addReview);

module.exports = router;
