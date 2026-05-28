const { prisma } = require('../config/database');
const { sendBookingConfirmation, sendBookingCancellation } = require('../utils/mailer');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const generateIdempotencyKey = (userId, carId, startDate) => {
  const normalizedDate = new Date(startDate).toISOString().split('T')[0];
  return `${userId}_${carId}_${normalizedDate}`;
};

const calculateRefund = (startDate, totalCost) => {
  const now = new Date();
  const hoursBeforeStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  if (hoursBeforeStart > 24) return totalCost;
  else if (hoursBeforeStart >= 6) return totalCost * 0.5;
  return 0;
};

const processStripeRefund = async (paymentIntentId, refundAmount) => {
  try {
    if (!paymentIntentId) return { refundId: null, status: 'skipped' };
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (intent.status !== 'succeeded') return { refundId: null, status: 'failed' };
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

    if (!carId || !startDate || !endDate || !paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Missing required fields (car_id, start_date, end_date, payment_intent_id)'
      });
    }

    const idempotencyKey = generateIdempotencyKey(userId, carId, startDate);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Pre-validation (cheap checks)
    const driverDoc = await prisma.driverDocument.findUnique({ where: { userId } });
    if (!driverDoc || driverDoc.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Driving license verification is required before booking'
      });
    }

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

    // ATOMIC TRANSACTION - Prevents ALL race conditions
    const result = await prisma.$transaction(async (tx) => {
      const existingByPaymentIntent = await tx.booking.findFirst({
        where: { stripeIntentId: paymentIntentId },
      });

      if (existingByPaymentIntent) {
        return { existing: existingByPaymentIntent, type: 'payment_intent' };
      }

      const existingByUserDates = await tx.booking.findFirst({
        where: {
          userId,
          carId,
          status: { in: ['confirmed', 'active'] },
          startDate: start,
          endDate: end,
        },
      });

      if (existingByUserDates) {
        return { existing: existingByUserDates, type: 'user_dates' };
      }

      const overlap = await tx.booking.findFirst({
        where: {
          carId,
          status: { in: ['confirmed', 'active'] },
          OR: [{ startDate: { lte: end }, endDate: { gte: start } }],
        },
      });

      if (overlap) {
        throw new Error('DATE_CONFLICT');
      }

      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalCost = parseFloat(car.pricePerDay) * days;

      const booking = await tx.booking.create({
        data: {
          userId,
          carId,
          startDate: start,
          endDate: end,
          totalCost,
          status: 'confirmed',
          paymentStatus: 'paid',
          stripeIntentId: paymentIntentId,
          idempotencyKey,
        },
        include: {
          car: { select: { name: true, brand: true, pricePerDay: true } },
          user: { select: { name: true, email: true } },
        },
      });

      return { booking };
    });

    if (result?.existing) {
      const existing = await prisma.booking.findFirst({
        where: { stripeIntentId: result.existing.stripeIntentId || result.existing.id },
        include: {
          car: { select: { name: true, brand: true, pricePerDay: true } },
          user: { select: { name: true, email: true } },
        },
      });

      return res.status(200).json({
        success: true,
        message: result.type === 'payment_intent'
          ? 'Booking already exists for this payment'
          : 'You already have a booking for these dates',
        data: existing,
      });
    }

    if (result?.booking) {
      try {
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: { bookingId: result.booking.id, idempotencyKey },
        });
      } catch (err) {
        console.error('[BOOKING] Failed to update metadata:', err.message);
      }

      sendBookingConfirmation(result.booking.user.email, result.booking);

      return res.status(201).json({
        success: true,
        message: 'Booking confirmed successfully!',
        data: result.booking,
      });
    }

  } catch (error) {
    if (error.message === 'DATE_CONFLICT') {
      return res.status(409).json({
        success: false,
        error: 'DATE_CONFLICT',
        message: 'Car is already booked for the selected dates'
      });
    }
    next(error);
  }
};

const getBookings = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const where = isAdmin ? {} : { userId: req.user.id };

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        car: { include: { branch: true } },
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

module.exports = {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  getBookedDates,
};