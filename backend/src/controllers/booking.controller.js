const { prisma } = require('../config/database');
const { sendBookingConfirmation } = require('../utils/mailer');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

// POST /api/v1/bookings
const createBooking = async (req, res, next) => {
  try {
    console.log('[BOOKING DEBUG] Request body:', req.body);
    
    // Strictly use the authenticated user's ID to prevent IDOR
    const userId = req.user.id;
    const carId = req.body.car_id;
    const startDate = req.body.start_date;
    const endDate = req.body.end_date;
    const paymentIntentId = req.body.payment_intent_id;

    if (!carId || !startDate || !endDate || !paymentIntentId) {
      return res.status(400).json({ success: false, message: 'Missing required fields (car_id, start_date, end_date, payment_intent_id)' });
    }

    // Idempotency check: If webhook already created this booking, return it immediately
    const existingBooking = await prisma.booking.findFirst({
      where: { stripeIntentId: paymentIntentId },
      include: {
        car: { select: { name: true, brand: true, pricePerDay: true } },
        user: { select: { name: true, email: true } },
      }
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
    
    // Normalize "now" to the start of the day to avoid 400 errors for same-day bookings
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (start < now) {
      console.warn('[BOOKING] Start date is in the past:', { start, now });
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

    // Check car exists and is available (general availability, not booking conflict)
    const car = await prisma.car.findUnique({ where: { id: carId } });
    if (!car) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Car not found' });
    }
    if (!car.availability) {
      return res.status(409).json({ success: false, error: 'UNAVAILABLE', message: 'This car is currently not in service' });
    }

    // Check for overlapping bookings
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

    // Calculate total cost (consistent with payment and frontend logic)
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const totalCost = parseFloat(car.pricePerDay) * days;

    let paymentStatus = 'pending';
    let retries = 0;
    const maxRetries = 5; // Increased from 3 to 5
    let lastIntentStatus = null;
    
    // Retry logic to check payment intent status (accounting for Stripe processing delay)
    while (retries < maxRetries && paymentStatus === 'pending') {
      try {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        lastIntentStatus = intent.status;
        console.log(`[BOOKING DEBUG] Stripe Intent Status (Attempt ${retries + 1}/${maxRetries}): ${intent.status}`);
        
        if (intent.status === 'succeeded') {
          paymentStatus = 'paid';
        } else if (intent.status === 'processing') {
          // Payment is processing, allow booking but mark as pending
          console.log('[BOOKING DEBUG] Payment is processing, creating booking with pending status');
          paymentStatus = 'pending';
          break; // Exit retry loop
        } else if (intent.status === 'requires_action' || intent.status === 'requires_payment_method') {
          // Payment not completed - retry after delay
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
          } else {
            // Max retries reached - allow booking but mark as pending, let webhook update it
            console.log(`[BOOKING DEBUG] Max retries reached at status: ${intent.status}, creating booking with pending status`);
            paymentStatus = 'pending';
          }
        } else if (intent.status === 'canceled') {
          // Payment definitely failed
          return res.status(400).json({ success: false, message: `Payment was cancelled` });
        }
      } catch (err) {
        console.error('[BOOKING DEBUG] Stripe retrieval error:', err.message);
        return res.status(400).json({ success: false, message: 'Invalid payment intent ID' });
      }
    }
    
    console.log(`[BOOKING DEBUG] Final payment status: ${paymentStatus}, last intent status: ${lastIntentStatus}`);

    // Create booking in a transaction
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
      // REMOVED: Toggling car.availability = false
      return newBooking;
    });

    // Update Stripe payment intent metadata with bookingId for webhook reference
    try {
      await stripe.paymentIntents.update(paymentIntentId, {
        metadata: { bookingId: booking.id }
      });
    } catch (err) {
      console.error('[BOOKING] Failed to update payment intent metadata:', err.message);
      // Don't fail the booking if this fails, just log it
    }

    // Send async confirmation email
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
    console.log('[BOOKING CONTROLLER] getBookings called', {
      userId: req.user?.id,
      userRole: req.user?.role,
      isAdmin: req.user?.role === 'admin',
      timestamp: new Date().toISOString(),
    });

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

    console.log('[BOOKING CONTROLLER] Bookings retrieved successfully', {
      count: bookings.length,
      hasData: bookings.length > 0,
      firstBookingStructure: bookings.length > 0 ? {
        hasId: !!bookings[0].id,
        hasCar: !!bookings[0].car,
        hasUser: !!bookings[0].user,
        hasStatus: !!bookings[0].status,
        carHasName: !!bookings[0].car?.name,
        userHasName: !!bookings[0].user?.name,
      } : 'no-bookings',
      timestamp: new Date().toISOString(),
    });

    // ✅ Validate response shape before sending
    const responseData = {
      success: true,
      data: bookings,
      count: bookings.length,
    };

    console.log('[BOOKING CONTROLLER] Sending response', {
      statusCode: 200,
      isArray: Array.isArray(responseData.data),
      dataLength: responseData.data.length,
    });

    res.json(responseData);
  } catch (error) {
    console.error('[BOOKING CONTROLLER] getBookings error', {
      errorMessage: error.message,
      errorStack: error.stack,
      userId: req.user?.id,
      timestamp: new Date().toISOString(),
    });
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

    // Only owner or admin can view
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
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Booking not found' });
    }
    if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied' });
    }
    if (booking.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'ALREADY_CANCELLED', message: 'Booking is already cancelled' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const cancelled = await tx.booking.update({
        where: { id: req.params.id },
        data: { status: 'cancelled' },
      });
      // REMOVED: Toggling car.availability = true
      return cancelled;
    });

    res.json({ success: true, message: 'Booking cancelled successfully', data: updated });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/bookings/car/:carId/dates
const getBookedDates = async (req, res, next) => {
  try {
    const { carId } = req.params;
    
    console.log('[BOOKING CONTROLLER] getBookedDates called', {
      carId,
      timestamp: new Date().toISOString(),
    });

    const bookings = await prisma.booking.findMany({
      where: {
        carId,
        status: { in: ['confirmed', 'active'] },
        endDate: { gte: new Date() }, // Only future bookings
      },
      select: {
        startDate: true,
        endDate: true,
      },
    });

    console.log('[BOOKING CONTROLLER] Booked bookings found', {
      carId,
      bookingCount: bookings.length,
      timestamp: new Date().toISOString(),
    });

    // Flatten date ranges into a list of specific dates
    const bookedDates = [];
    bookings.forEach((booking) => {
      let current = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      
      while (current <= end) {
        bookedDates.push(new Date(current).toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
      }
    });

    // Remove duplicates and sort
    const uniqueDates = [...new Set(bookedDates)].sort();

    console.log('[BOOKING CONTROLLER] Booked dates calculated', {
      carId,
      uniqueDateCount: uniqueDates.length,
      sampleDates: uniqueDates.slice(0, 3),
      timestamp: new Date().toISOString(),
    });

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
