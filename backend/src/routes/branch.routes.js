const { authenticate, authorizeAdmin } = require('../middleware/auth.middleware');
const router = require('express').Router();
const {
  getBranches,
  getBranchById,
  getNearestBranch,
  createBranch,
  updateBranch,
  deleteBranch,
} = require('../controllers/branch.controller');

// Public routes
router.get('/', getBranches);                    // GET /api/v1/branches?lat=&lng= (optional location params)
router.get('/nearest', getNearestBranch);        // GET /api/v1/branches/nearest?lat=&lng=
router.get('/:id', getBranchById);               // GET /api/v1/branches/:id

// Admin-only routes
router.use(authenticate);
router.post('/', authorizeAdmin, createBranch);
router.put('/:id', authorizeAdmin, updateBranch);
router.delete('/:id', authorizeAdmin, deleteBranch);

module.exports = router;
