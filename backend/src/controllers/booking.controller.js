const { prisma } = require('../config/database');
const { sendBookingCancellation } = require('../utils/mailer');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

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
    
    // Get payment intent to verify it exists and is captured
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (intent.status !== 'succeeded') {
      return { refundId: null, status: 'failed' };
    }
    
    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: Math.round(refundAmount * 100), // Convert to cents
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

    if (!carId || !startDate || !endDate || !paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Missing required fields (car_id, start_date, end_date, payment_intent_id)' });
    }

    // Idempotency check
    const existingBooking = await prisma.booking.findFirst({
      where: { stripeIntentId: paymentIntentId },
      include: {
        car: { select: { name: true, brand: true, pricePerDay: true } },
        user: { select: { name: true, email: true } },
      },
    });

    if (existingBooking) {
      console.log(`[BOOKING DEBUG] Returning existing booking via idempotency check: ${existingBooking.id}`);
      return res.status(200).json({
        success: true,
        message: 'Booking retrieved successfully',
        data: existingBooking,
      });
    }

    const driverDoc = await prisma.driverDocument.findUnique({ where: { userId } });
    if (!driverDoc || driverDoc.verificationStatus !== 'approved') {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Driving license verification is required before booking' });
    }

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

    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Car not found' });
    }
    if (!car.availability) {
      return res.status(409).json({ success: false, error: 'UNAVAILABLE', message: 'This car is currently not in service' });
    }

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

    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalCost = parseFloat(car.pricePerDay) * days;

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
          return res.status(400).json({ success: false, message: `Payment was cancelled` });
        }
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid payment intent ID' });
      }
    }

    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: { 
          userId, 
          carId, 
          startDate: start, 
          endDate: end, 
          totalCost, 
          status: 'confirmed', 
          paymentStatus, 
          stripeIntentId: paymentIntentId 
        },
        include: {
          car: { select: { name: true, brand: true, pricePerDay: true } },
          user: { select: { name: true, email: true } },
        },
      });
      return newBooking;
    });

    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { bookingId: booking.id }
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
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
    }

    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied' });
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
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
    }
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'ALREADY_CANCELLED', message: 'Booking is already cancelled' });
    }

    // Prevent cancellation after booking start time
    const now = new Date();
    if (booking.startDate <= now) {
      return res.status(400).json({ 
        success: false, 
        error: 'BOOKING_STARTED', 
        message: 'Cannot cancel a booking that has already started' 
      });
    }

    // Calculate refund amount
    const refundAmount = calculateRefund(booking.startDate, booking.totalCost || 0);
    
    // Prepare refund if payment exists
    let refundStatus = 'not_requested';
    let refundId = null;
    
    if (booking.stripeIntentId && booking.paymentStatus === 'paid' && refundAmount > 0) {
      refundStatus = 'pending';
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update booking with cancellation details
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

      // Create audit log for admin actions
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

    // Process refund asynchronously (outside transaction)
    if (booking.stripeIntentId && booking.paymentStatus === 'paid' && refundAmount > 0) {
      setImmediate(async () => {
        try {
          const result = await processStripeRefund(booking.stripeIntentId, refundAmount);
          
          // Update refund status
          await prisma.booking.update({
            where: { id: req.params.id },
            data: {
              refundStatus: result.status,
              refundId: result.refundId,
            },
          });

          // Send cancellation email
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
      // Still send cancellation email for no-refund scenarios
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

module.exports = { createBooking, getBookings, getBookingById, cancelBooking, getBookedDates };