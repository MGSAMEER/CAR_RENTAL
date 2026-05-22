const { prisma } = require('../config/database');

// GET /api/v1/admin/stats
const getDashboardStats = async (req, res, next) => {
  try {
    const [totalCars, totalUsers, allBookings] = await Promise.all([
      prisma.car.count(),
      prisma.user.count({ where: { role: 'user' } }),
      prisma.booking.findMany({ select: { totalCost: true, status: true, createdAt: true } }),
    ]);

    const activeBookings = allBookings.filter(b => b.status === 'confirmed' || b.status === 'active');
    const totalRevenue = allBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + Number(b.totalCost), 0);

    // Compare last 30 days vs prior 30 days for growth
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const recentBookings = allBookings.filter(b => new Date(b.createdAt) >= thirtyDaysAgo && b.status !== 'cancelled');
    const priorBookings = allBookings.filter(b => new Date(b.createdAt) >= sixtyDaysAgo && new Date(b.createdAt) < thirtyDaysAgo && b.status !== 'cancelled');

    const recentRevenue = recentBookings.reduce((s, b) => s + Number(b.totalCost), 0);
    const priorRevenue = priorBookings.reduce((s, b) => s + Number(b.totalCost), 0);
    const revenueGrowth = priorRevenue > 0 ? (((recentRevenue - priorRevenue) / priorRevenue) * 100).toFixed(1) : 100;
    const bookingGrowth = priorBookings.length > 0 ? (((recentBookings.length - priorBookings.length) / priorBookings.length) * 100).toFixed(1) : 100;

    res.json({
      success: true,
      data: {
        totalRevenue,
        totalBookings: allBookings.length,
        activeBookings: activeBookings.length,
        totalUsers,
        totalCars,
        revenueGrowth: Number(revenueGrowth),
        bookingGrowth: Number(bookingGrowth),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/revenue  — last 30 days grouped by day
const getRevenueChart = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: thirtyDaysAgo },
        status: { not: 'cancelled' },
      },
      select: { createdAt: true, totalCost: true },
    });

    // Build a map for all 30 days
    const dayMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = 0;
    }

    bookings.forEach(b => {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      if (dayMap[key] !== undefined) dayMap[key] += Number(b.totalCost);
    });

    const data = Object.entries(dayMap).map(([date, revenue]) => ({
      date,
      revenue: Math.round(revenue),
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/bookings-chart  — last 30 days grouped by day
const getBookingsChart = async (req, res, next) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const bookings = await prisma.booking.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, status: true },
    });

    const dayMap = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(thirtyDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = { bookings: 0, cancelled: 0 };
    }

    bookings.forEach(b => {
      const key = new Date(b.createdAt).toISOString().slice(0, 10);
      if (dayMap[key]) {
        dayMap[key].bookings++;
        if (b.status === 'cancelled') dayMap[key].cancelled++;
      }
    });

    const data = Object.entries(dayMap).map(([date, vals]) => ({ date, ...vals }));
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/top-cars  — top 5 most rented
const getTopCars = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.groupBy({
      by: ['carId'],
      _count: { carId: true },
      _sum: { totalCost: true },
      orderBy: { _count: { carId: 'desc' } },
      take: 5,
    });

    const carIds = bookings.map(b => b.carId);
    const cars = await prisma.car.findMany({
      where: { id: { in: carIds } },
      select: { id: true, name: true, brand: true, type: true, imageUrl: true, pricePerDay: true },
    });

    const carMap = Object.fromEntries(cars.map(c => [c.id, c]));
    const data = bookings.map(b => ({
      car: carMap[b.carId],
      bookingCount: b._count.carId,
      totalRevenue: Number(b._sum.totalCost) || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/payments  — payment tracking
const getPaymentTracking = async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        totalCost: true,
        paymentStatus: true,
        stripeIntentId: true,
        status: true,
        createdAt: true,
        car: { select: { name: true, brand: true } },
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: bookings, count: bookings.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/admin/verifications
const getVerifications = async (req, res, next) => {
  try {
    const docs = await prisma.driverDocument.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: docs });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/admin/verify-user/:userId
const verifyUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updatedDoc = await prisma.driverDocument.update({
      where: { userId },
      data: { verificationStatus: status },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ success: true, message: `User verification ${status}`, data: updatedDoc });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDashboardStats, getRevenueChart, getBookingsChart, getTopCars, getPaymentTracking, getVerifications, verifyUser };
