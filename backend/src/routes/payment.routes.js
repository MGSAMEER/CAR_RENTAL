const express = require('express');
const { createPaymentIntent, handleWebhook } = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// The webhook must use the raw body parser, so it's handled in app.js or configured directly on the route.
// Express handles raw body parsing in app.js if we set it up carefully, but typically webhooks need express.raw.
// To keep it simple, we'll configure raw parsing for the webhook in app.js.
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

router.use(authenticate);
router.post('/create-intent', createPaymentIntent);

module.exports = router;
