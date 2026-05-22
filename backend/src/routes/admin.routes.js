const router = require('express').Router();
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
const {
  getDashboardStats,
  getRevenueChart,
  getBookingsChart,
  getTopCars,
  getPaymentTracking,
  getVerifications,
  verifyUser,
} = require('../controllers/admin.controller');

const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');

// All admin routes require authentication + admin role
router.use(authenticate, authorizeAdmin);

const adminRules = {
  verifyUser: [
    body('status').isIn(['approved', 'rejected']).withMessage('Status must be either approved or rejected'),
  ],
};

router.get('/stats', getDashboardStats);
router.get('/revenue', getRevenueChart);
router.get('/bookings-chart', getBookingsChart);
router.get('/top-cars', getTopCars);
router.get('/payments', getPaymentTracking);
router.get('/verifications', getVerifications);
router.patch('/verify-user/:userId', adminRules.verifyUser, validate, verifyUser);

module.exports = router;
