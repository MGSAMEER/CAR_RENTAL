const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

const createPaymentIntent = async (req, res, next) => {
  try {
    const { carId, startDate, endDate } = req.body;

    const driverDoc = await prisma.driverDocument.findUnique({ where: { userId: req.user.id } });
    if (!driverDoc || driverDoc.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Driving license verification is required before booking' });
    }
    
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Car not found' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Calculate days including the start and end date (consistent with frontend logic)
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalCost = parseFloat(car.pricePerDay) * days;

    if (isNaN(totalCost) || totalCost <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid rental duration or cost calculation' });
    }

    console.log('[STRIPE] Creating Payment Intent:', { carId, days, totalCost, currency: 'inr' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalCost * 100), // in cents
      currency: 'inr',
      metadata: { 
        carId, 
        userId: req.user.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalCost: totalCost.toString(),
      }
    });

    res.json({ success: true, data: { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id } });
  } catch (error) {
    logger.error(`[STRIPE] Error creating payment intent: ${error.message}`, error);
    next(error);
  }
};

const handleWebhook = async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`[WEBHOOK] Signature verification failed: ${err.message}`, err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const intentId = paymentIntent.id;
      const { carId, userId, startDate, endDate, totalCost } = paymentIntent.metadata;

      logger.info(`[WEBHOOK] Payment succeeded for intent: ${intentId}`);

      // Idempotency: Check if booking already exists
      let booking = await prisma.booking.findFirst({
        where: { stripeIntentId: intentId }
      });

      if (booking) {
        // Update existing booking
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: 'paid', status: 'confirmed' }
        });
        logger.info(`[WEBHOOK] Existing booking ${booking.id} updated to paid`);
        
        // Notify user of successful payment
        const { sendPaymentSuccessEmail, sendBookingConfirmation } = require('../utils/mailer');
        const user = await prisma.user.findUnique({ where: { id: booking.userId }});
        if (user) {
          sendPaymentSuccessEmail(user.email, paymentIntent.amount / 100, paymentIntent.receipt_url || null);
          sendBookingConfirmation(user.email, booking);
        }

      } else if (carId && userId && startDate && endDate) {
        // Source of Truth: Create booking because frontend didn't
        booking = await prisma.booking.create({
          data: {
            userId,
            carId,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            totalCost: parseFloat(totalCost) || 0,
            status: 'confirmed',
            paymentStatus: 'paid',
            stripeIntentId: intentId
          },
          include: {
            user: { select: { email: true } },
          }
        });
        logger.info(`[WEBHOOK] Webhook created new booking: ${booking.id}`);
        
        // Send email confirmation
        const { sendBookingConfirmation, sendPaymentSuccessEmail } = require('../utils/mailer');
        sendPaymentSuccessEmail(booking.user.email, paymentIntent.amount / 100, paymentIntent.receipt_url || null);
        sendBookingConfirmation(booking.user.email, booking);
      } else {
        logger.warn(`[WEBHOOK] Missing metadata for intent: ${intentId}`);
      }

    } else if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object;
      
      const booking = await prisma.booking.findFirst({
        where: { stripeIntentId: paymentIntent.id }
      });

      if (booking) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: 'failed', status: 'cancelled' }
        });
        logger.info(`[WEBHOOK] Booking ${booking.id} marked as failed`);
      }
    } else if (event.type === 'charge.refunded') {
      // Handle refunds!
      const charge = event.data.object;
      const intentId = charge.payment_intent;
      
      const booking = await prisma.booking.findFirst({
        where: { stripeIntentId: intentId },
        include: { car: { select: { name: true } }, user: { select: { email: true } } }
      });

      if (booking) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: { paymentStatus: 'refunded', status: 'cancelled' }
        });
        logger.info(`[WEBHOOK] Booking ${booking.id} marked as refunded`);
        
        const { sendRefundNotification } = require('../utils/mailer');
        sendRefundNotification(booking.user.email, charge.amount_refunded / 100, booking.car.name);
      }
    }

    res.json({ received: true });
  } catch (error) {
    logger.error(`[WEBHOOK] Error processing event: ${error.message}`, error);
    next(error);
  }
};

module.exports = { createPaymentIntent, handleWebhook };
