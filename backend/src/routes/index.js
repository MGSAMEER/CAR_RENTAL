const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const carRoutes = require('./car.routes');
const bookingRoutes = require('./booking.routes');
const userRoutes = require('./user.routes');
const paymentRoutes = require('./payment.routes');
const adminRoutes = require('./admin.routes');
const branchRoutes = require('./branch.routes');

// Centralized v1 routes
router.use('/auth', authRoutes);
router.use('/cars', carRoutes);
router.use('/bookings', bookingRoutes);
router.use('/users', userRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);
router.use('/branches', branchRoutes);

module.exports = router;
