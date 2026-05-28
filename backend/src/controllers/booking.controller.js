const { prisma } = require('../config/database');
const { sendBookingConfirmation } = require('../utils/mailer');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

/**
 * Generate idempotency key from booking parameters
 * Format: userId_carId_startDate (normalized to prevent timezone issues)
 */
const generateIdempotencyKey = (userId, carId, startDate) => {
  const normalizedDate = new Date(startDate).toISOString().split('T')[0]; // YYYY-MM-DD
  return `${userId}_${carId}_${normalizedDate}`;
};

/**
 * Calculate refund amount based on time before booking starts
 * @param {Date} startDate - Booking start date
 * @param {number} totalCost - Total booking cost
 * @returns {number} - Refund amount
 */
const calculateRefund = (startDate, totalCost) => {
  const now = new Date();
  const hoursBeforeStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  
  if (hoursBeforeStart > 24) {
    return totalCost; // 100% refund
  } else if (hoursBeforeStart >= 6) {
    return totalCost * 0.5; // 50% refund
  } else {
    return 0; // No refund
  }
};

/**
 * Process Stripe refund
 * @param {string} paymentIntentId - Stripe payment intent ID
 * @param {number} refundAmount - Amount to refund (in cents)
 * @returns {Promise<{refundId: string, status: string}>}
 */
const processStripeRefund = async (paymentIntentId, refundAmount) => {
  try {
    if (!paymentIntentId) {
      return { refundId: null, status: 'skipped' };
    }
    
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (intent.status !== 'succeeded') {
      return { refundId: null, status: 'failed' };
    }
    
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(refundAmount * 100),
    });
    
    return { refundId: refund.id, status: 'processed' };
  } catch (error) {
    console.error('[REFUND] Stripe refund error:', error.message);
    return { refundId: null, status: 'failed' };
  }
};

// POST /api/v1/bookings
const createBooking = async (req, res, next) => {
  try {
    console.log('[BOOKING DEBUG] Request body:', req.body);
    
    const userId = req.user.id;
    const carId = req.body.car_id;
    const startDate = req.body.start_date;
    const endDate = req.body.end_date;
    const paymentIntentId = req.body.payment_intent_id;

    // Validate required fields
    if (!carId || !startDate || !endDate || !paymentIntentId) {
      return res.status(400).json({ 
        success: false, 
        error: 'MISSING_FIELDS',
        message: 'Missing required fields (car_id, start_date, end_date, payment_intent_id)' 
      });
    }

// ==================== LAYER 1: Payment Intent Idempotency Check ====================
    // Check if booking already exists with this payment intent (prevents webhook + API duplicate)
    const existingByPaymentIntent = await prisma.booking.findFirst({
      where: { stripeIntentId: paymentIntentId },
      include: {
        car: { select: { name: true, brand: true, pricePerDay: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (existingByPaymentIntent) {
      console.log(`[BOOKING DEBUG] Returning existing booking via paymentIntent check: ${existingByPaymentIntent.id}`);
      return res.status(200).json({
        success: true,
        message: 'Booking already exists for this payment',
        data: existingByPaymentIntent,
      });
    }

// ==================== LAYER 2: Duplicate Booking Check ====================
    // Check if user already has a confirmed booking for same car + dates
    const existingByDates = await prisma.booking.findFirst({
      where: {
        userId,
        carId,
        status: { in: ['confirmed', 'active'] },
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
      include: {
        car: { select: { name: true, brand: true, pricePerDay: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (existingByDates) {
      console.log(`[BOOKING DEBUG] Returning existing booking via duplicate check: ${existingByDates.id}`);
      return res.status(200).json({
        success: true,
        message: 'You already have a booking for this car on these dates',
        data: existingByDates,
      });
    }

// ==================== LAYER 3: Driver Verification Check ====================
    const driverDoc = await prisma.driverDocument.findUnique({ where: { userId } });
    if (!driverDoc || driverDoc.verificationStatus !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        error: 'FORBIDDEN', 
        message: 'Driving license verification is required before booking' 
      });
    }

// ==================== Date Validations ====================
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (start < now) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATE',
        message: 'Start date must be today or in the future',
      });
    }
    if (end <= start) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_DATE',
        message: 'End date must be after start date',
      });
    }

// ==================== Car Availability Check ====================
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      return res.status(404).json({ 
        success: false, 
        error: 'NOT_FOUND', 
        message: 'Car not found' 
      });
    }
    if (!car.availability) {
      return res.status(409).json({ 
        success: false, 
        error: 'UNAVAILABLE', 
        message: 'This car is currently not in service' 
      });
    }

// ==================== Date Overlap Check (Race Condition Safety) ====================
    const overlap = await prisma.booking.findFirst({
      where: {
        carId,
        status: { in: ['confirmed', 'active'] },
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });
    if (overlap) {
      return res.status(409).json({
        success: false,
        error: 'DATE_CONFLICT',
        message: 'Car is already booked for the selected dates',
      });
    }

// ==================== Calculate Cost ====================
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalCost = parseFloat(car.pricePerDay) * days;

// ==================== Verify Payment Status ====================
    let paymentStatus = 'pending';
    let retries = 0;
    const maxRetries = 5;
    let lastIntentStatus = null;
    
    while (retries < maxRetries && paymentStatus === 'pending') {
      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        lastIntentStatus = intent.status;
        
        if (intent.status === 'succeeded') {
          paymentStatus = 'paid';
        } else if (intent.status === 'processing') {
          paymentStatus = 'pending';
          break;
        } else if (intent.status === 'requires_action' || intent.status === 'requires_payment_method') {
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            paymentStatus = 'pending';
          }
        } else if (intent.status === 'canceled') {
          return res.status(400).json({ 
            success: false, 
            error: 'PAYMENT_CANCELLED',
            message: 'Payment was cancelled' 
          });
        }
      } catch (err) {
        return res.status(400).json({ 
          success: false, 
          error: 'INVALID_PAYMENT_INTENT',
          message: 'Invalid payment intent ID' 
        });
      }
    }

// ==================== ATOMIC BOOKING CREATION WITH IDEMPOTENCY KEY ====================
    const idempotencyKey = generateIdempotencyKey(userId, carId, startDate);

    const booking = await prisma.$transaction(async (tx) => {
      // Double-check inside transaction for race condition safety
      const existingInTx = await tx.booking.findFirst({
        where: {
          OR: [
            { stripeIntentId: paymentIntentId },
            { idempotencyKey },
          ],
        },
      });

      if (existingInTx) {
        return existingInTx; // Return existing booking
      }

      const newBooking = await tx.booking.create({
        data: { 
          userId, 
          carId, 
          startDate: start, 
          endDate: end, 
          totalCost, 
          status: 'confirmed', 
          paymentStatus, 
          stripeIntentId: paymentIntentId,
          idempotencyKey,
        },
        include: {
          car: { select: { name: true, brand: true, pricePerDay: true } },
          user: { select: { name: true, email: true } },
        },
      });
      
      return newBooking;
    });

// ==================== Handle Webhook Race Condition ====================
    // If we returned an existing booking from transaction
    if (booking.stripeIntentId === paymentIntentId) {
      console.log(`[BOOKING DEBUG] Booking created via atomic transaction: ${booking.id}`);
      sendBookingConfirmation(booking.user.email, booking);
    }

// ==================== Update Stripe Metadata ====================
    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { 
          bookingId: booking.id,
          idempotencyKey,
        }
      });
    } catch (err) {
      console.error('[BOOKING] Failed to update payment intent metadata:', err.message);
    }

    sendBookingConfirmation(booking.user.email, booking);

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully!',
      data: { ...booking, days, totalCost },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/bookings  [Admin: all | User: own]
const getBookings = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? {} : { userId: req.user.id };

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        car: { 
          include: { branch: true },
        },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: bookings,
      count: bookings.length,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/bookings/:id
const getBookingById = async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        car: { include: { branch: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'NOT_FOUND', 
        message: 'Booking not found' 
      });
    }

    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'FORBIDDEN', 
        message: 'Access denied' 
      });
    }

    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/bookings/:id/cancel
const cancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await prisma.booking.findUnique({ 
      where: { id: req.params.id },
      include: { user: true, car: true }
    });

    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        error: 'NOT_FOUND', 
        message: 'Booking not found' 
      });
    }
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ 
        success: false, 
        error: 'FORBIDDEN', 
        message: 'Access denied' 
      });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ 
        success: false, 
        error: 'ALREADY_CANCELLED', 
        message: 'Booking is already cancelled' 
      });
    }

    const now = new Date();
    if (booking.startDate <= now) {
      return res.status(400).json({ 
        success: false, 
        error: 'BOOKING_STARTED', 
        message: 'Cannot cancel a booking that has already started' 
      });
    }

    const refundAmount = calculateRefund(booking.startDate, booking.totalCost || 0);
    
    let refundStatus = 'not_requested';
    let refundId = null;
    
    if (booking.stripeIntentId && booking.paymentStatus === 'paid' && refundAmount > 0) {
      refundStatus = 'pending';
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id: req.params.id },
        data: { 
          status: 'cancelled',
          cancelledAt: new Date(),
          cancellationReason: reason || null,
          refundAmount,
          refundStatus,
        },
      });

      if (req.user.role === 'admin') {
        await tx.auditLog.create({
          data: {
            adminId: req.user.id,
            action: 'CANCEL_BOOKING',
            entity: 'Booking',
            entityId: req.params.id,
            details: { reason, refundAmount, refundStatus }
          }
        });
      }
      
      return cancelled;
    });

    if (booking.stripeIntentId && booking.paymentStatus === 'paid' && refundAmount > 0) {
      setImmediate(async () => {
        try {
          const result = await processStripeRefund(booking.stripeIntentId, refundAmount);
          
          await prisma.booking.update({
            where: { id: req.params.id },
            data: {
              refundStatus: result.status,
              refundId: result.refundId,
            },
          });

          sendBookingCancellation(booking.user.email, {
            ...booking,
            refundAmount,
            refundStatus: result.status,
          });
        } catch (error) {
          console.error('[CANCEL] Background refund error:', error);
        }
      });
    } else {
      sendBookingCancellation(booking.user.email, {
        ...booking,
        refundAmount,
        refundStatus: 'not_requested',
      });
    }

    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully', 
      data: {
        ...updated,
        refundAmount,
        refundStatus,
        refundPolicy: 'Full refund if >24h before start, 50% if 6-24h, no refund if <6h'
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/bookings/car/:carId/dates
const getBookedDates = async (req, res, next) => {
  try {
    const { carId } = req.params;

    const bookings = await prisma.booking.findMany({
      where: {
        carId,
        status: { in: ['confirmed', 'active'] },
        endDate: { gte: new Date() },
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    const bookedDates = [];
    bookings.forEach((booking) => {
      let current = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      
      while (current <= end) {
        bookedDates.push(new Date(current).toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    const uniqueDates = [...new Set(bookedDates)].sort();

    res.json({
      success: true,
      data: {
        ranges: bookings,
        individualDates: uniqueDates
      }
    });
  } catch (error) {
    next(error);
  }
};

// ==================== BONUS: Handle payment success but booking fails ====================
const handleFailedBookingRecovery = async (paymentIntentId) => {
  // This can be called by cron job or admin to handle orphaned payments
  const existing = await prisma.booking.findFirst({
    where: { stripeIntentId: paymentIntentId },
  });
  
  if (!existing) {
    // Payment exists but no booking - initiate refund
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status === 'succeeded') {
      await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: intent.amount,
      });
    }
  }
};

module.exports = { 
  createBooking, 
  getBookings, 
  getBookingById, 
  cancelBooking, 
  getBookedDates,
  handleFailedBookingRecovery,
};