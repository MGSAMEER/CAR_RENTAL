const router = require('express').Router();
const { getUsers, getUserById, updateUser, deleteUser, getUserBookings, blockUser, unblockUser, uploadLicense, getVerificationStatus } = require('../controllers/user.controller');
const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate.middleware');
const { upload } = require('../utils/cloudinary');

const userRules = {
  update: [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty').escape(),
  ],
  license: [
    body('licenseNumber').trim().notEmpty().withMessage('License number is required').escape(),
    body('licenseExpiry').isISO8601().withMessage('Valid expiry date is required'),
  ],
};

router.use(authenticate);

// Specific routes first
router.post('/upload-license', upload.single('licenseFile'), userRules.license, validate, uploadLicense);
router.get('/verification-status', getVerificationStatus);

// Parameterized routes
router.get('/', authorizeAdmin, getUsers);
router.get('/:id', getUserById);
router.put('/:id', userRules.update, validate, updateUser);
router.delete('/:id', authorizeAdmin, deleteUser);
router.get('/:id/bookings', getUserBookings);
router.patch('/:id/block', authorizeAdmin, blockUser);
router.patch('/:id/unblock', authorizeAdmin, unblockUser);

module.exports = router;
