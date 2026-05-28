const { prisma } = require('../config/database');
const { sendBookingConfirmation } = require('../utils/mailer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

const generateIdempotencyKey = (userId, carId, startDate) => {
  return `${userId}_${carId}_${new Date(startDate).toISOString().split('T')[0]}`;
};

const createBooking = async (req, res, next) => {
  try {
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

    const idempotencyKey = generateIdempotencyKey(userId, carId, startDate);
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Pre-validation (cheap checks outside transaction)
    const [driverDoc, car] = await Promise.all([
      prisma.driverDocument.findUnique({ where: { userId } }),
      prisma.car.findUnique({ where: { id: carId } })
    ]);

    if (!driverDoc || driverDoc.verificationStatus !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Driving license verification required before booking'
      });
    }

    if (!car || !car.availability) {
      return res.status(404).json({
        success: false,
        error: car ? 'UNAVAILABLE' : 'NOT_FOUND',
        message: car ? 'This car is currently not in service' : 'Car not found'
      });
    }

    // ATOMIC TRANSACTION - SINGLE SOURCE OF TRUTH
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        // Check 1: Payment intent already has a booking (webhook race)
        const existingByPaymentIntent = await tx.booking.findFirst({
          where: { stripeIntentId: paymentIntentId },
          include: {
            car: { select: { name: true, brand: true, pricePerDay: true } },
            user: { select: { name: true, email: true } },
          },
        });

        if (existingByPaymentIntent) {
          return { existing: existingByPaymentIntent, type: 'payment_intent' };
        }

        // Check 2: Idempotency key exists (client retry race)
        const existingByIdempotency = await tx.booking.findFirst({
          where: { idempotencyKey },
          include: {
            car: { select: { name: true, brand: true, pricePerDay: true } },
            user: { select: { name: true, email: true } },
          },
        });

        if (existingByIdempotency) {
          return { existing: existingByIdempotency, type: 'idempotency' };
        }

        // Check 3: Date overlap (concurrent booking race)
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

        // All clear - create booking
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const totalCost = parseFloat(car.pricePerDay) * Math.max(1, days);

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
    } catch (error) {
      // Handle unique constraint violations (race condition fallback)
      if (error.code === 'P2002') {
        // Unique constraint failed - find the existing record
        const existing = await prisma.booking.findFirst({
          where: {
            OR: [
              { stripeIntentId: paymentIntentId },
              { idempotencyKey },
            ],
          },
          include: {
            car: { select: { name: true, brand: true, pricePerDay: true } },
            user: { select: { name: true, email: true } },
          },
        });

        if (existing) {
          return res.status(200).json({
            success: true,
            message: 'Booking already exists (created by concurrent request)',
            data: existing,
          });
        }
      }

      if (error.message === 'DATE_CONFLICT') {
        return res.status(409).json({
          success: false,
          error: 'DATE_CONFLICT',
          message: 'Car is already booked for the selected dates'
        });
      }

      throw error;
    }

    // Handle normal flow
    if (result?.existing) {
      return res.status(200).json({
        success: true,
        message: 'Booking already exists for this payment',
        data: result.existing,
      });
    }

    if (result?.booking) {
      // Update Stripe metadata
      try {
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            bookingId: result.booking.id,
            idempotencyKey,
          },
        });
      } catch (err) {
        console.error('Failed to update Stripe metadata:', err.message);
      }

      await sendBookingConfirmation(result.booking.user.email, result.booking);

      return res.status(201).json({
        success: true,
        message: 'Booking confirmed successfully!',
        data: result.booking,
      });
    }
  } catch (error) {
    next(error);
  }
};

module.exports = { createBooking };