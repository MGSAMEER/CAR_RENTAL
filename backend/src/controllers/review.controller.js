const { prisma } = require('../config/database');

const addReview = async (req, res, next) => {
  try {
    const { id: carId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Rating must be between 1 and 5' });
    }

    // Validate eligible booking
    const eligible = await prisma.booking.findFirst({
      where: { carId, userId, status: 'completed' }
    });
    if (!eligible) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You must complete a booking for this car to review it' });
    }

    // Use transaction to update review and car aggregate stats safely
    const review = await prisma.$transaction(async (tx) => {
      // Upsert to handle if they already left a review (updating their existing one)
      const existing = await tx.review.findFirst({ where: { userId, carId } });
      let newReview;
      if (existing) {
        newReview = await tx.review.update({
          where: { id: existing.id },
          data: { rating, comment }
        });
      } else {
        newReview = await tx.review.create({
          data: { rating, comment, carId, userId }
        });
      }

      const aggregates = await tx.review.aggregate({
        where: { carId },
        _avg: { rating: true },
        _count: { id: true }
      });

      await tx.car.update({
        where: { id: carId },
        data: { 
          ratingAvg: aggregates._avg.rating || 0,
          reviewCount: aggregates._count.id
        }
      });

      return newReview;
    });
    
    res.status(201).json({ success: true, message: 'Review added successfully', data: review });
  } catch (error) {
    next(error);
  }
};

const getReviews = async (req, res, next) => {
  try {
    const { id: carId } = req.params;
    const reviews = await prisma.review.findMany({
      where: { carId },
      include: {
        user: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
};

module.exports = { addReview, getReviews };
