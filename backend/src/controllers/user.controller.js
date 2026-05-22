const { prisma } = require('../config/database');

// GET /api/v1/users  [Admin]
const getUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isBlocked: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id  [Admin or self]
const getUserById = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied' });
    }
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' });
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/users/:id  [Self only]
const updateUser = async (req, res, next) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'You can only update your own profile' });
    }
    const { name } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(name && { name }) },
      select: { id: true, name: true, email: true, role: true },
    });
    res.json({ success: true, message: 'Profile updated successfully', data: user });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/users/:id  [Admin]
const deleteUser = async (req, res, next) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id/bookings
const getUserBookings = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Access denied' });
    }
    const bookings = await prisma.booking.findMany({
      where: { userId: req.params.id },
      include: {
        car: { select: { id: true, name: true, brand: true, type: true, imageUrl: true, pricePerDay: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: bookings, count: bookings.length });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/:id/block  [Admin]
const blockUser = async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBlocked: true },
      select: { id: true, name: true, email: true, isBlocked: true },
    });
    res.json({ success: true, message: 'User blocked successfully', data: user });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/:id/unblock  [Admin]
const unblockUser = async (req, res, next) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { isBlocked: false },
      select: { id: true, name: true, email: true, isBlocked: true },
    });
    res.json({ success: true, message: 'User unblocked successfully', data: user });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users/upload-license
const uploadLicense = async (req, res, next) => {
  try {
    const { licenseNumber, licenseExpiry } = req.body;
    const file = req.file;

    const logger = require('../utils/logger');
    const { uploadToCloudinary } = require('../utils/cloudinary');
    
    logger.debug(`[UPLOAD] req.body: ${JSON.stringify(req.body)}`);

    if (!file) {
      return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Document file (field name: licenseFile) is required. Allowed types: JPG, PNG, PDF. Max 5MB.' });
    }

    if (!licenseNumber || !licenseExpiry) {
      return res.status(400).json({ success: false, message: 'License number and expiry date are required.' });
    }

    if (new Date(licenseExpiry) < new Date()) {
      return res.status(400).json({ success: false, message: 'License expiry must be a future date' });
    }

    let documentUrl;
    
    // Upload buffer stream directly to Cloudinary
    try {
      const result = await uploadToCloudinary(file.buffer, 'driveeasy_licenses');
      documentUrl = result.secure_url;
    } catch (uploadError) {
      logger.error(`[UPLOAD] Cloudinary error: ${uploadError.message}`);
      return res.status(500).json({ success: false, error: 'UPLOAD_FAILED', message: 'Failed to upload document to cloud storage.' });
    }

    // Upsert driver document
    const driverDoc = await prisma.driverDocument.upsert({
      where: { userId: req.user.id },
      update: {
        licenseNumber,
        licenseExpiry: new Date(licenseExpiry),
        documentUrl: documentUrl,
        verificationStatus: 'pending',
      },
      create: {
        userId: req.user.id,
        licenseNumber,
        licenseExpiry: new Date(licenseExpiry),
        documentUrl: documentUrl,
        verificationStatus: 'pending',
      },
    });

    res.json({ success: true, message: 'License uploaded successfully', data: driverDoc });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/verification-status
const getVerificationStatus = async (req, res, next) => {
  try {
    const driverDoc = await prisma.driverDocument.findUnique({
      where: { userId: req.user.id },
    });

    res.json({
      success: true,
      data: driverDoc || { verificationStatus: 'unverified' },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getUsers, getUserById, updateUser, deleteUser, getUserBookings, blockUser, unblockUser, uploadLicense, getVerificationStatus };
