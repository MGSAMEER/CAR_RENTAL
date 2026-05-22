const { prisma } = require('../config/database');

// GET /api/v1/cars
const getCars = async (req, res, next) => {
  try {
    const { type, minPrice, maxPrice, available, search, city, branchId } = req.query;

    const where = {};

    if (type) where.type = type;
    if (available !== undefined) where.availability = available === 'true';
    if (branchId) where.branchId = branchId;

    // City-based filtering via branch relation
    if (city) {
      where.branch = { city: { equals: city } };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { brand: { contains: search } },
        { model: { contains: search } },
      ];
    }
    if (minPrice || maxPrice) {
      where.pricePerDay = {};
      if (minPrice) where.pricePerDay.gte = parseFloat(minPrice);
      if (maxPrice) where.pricePerDay.lte = parseFloat(maxPrice);
    }

    const cars = await prisma.car.findMany({
      where,
      include: { branch: true },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`[GET /api/v1/cars] Fetched ${cars.length} cars (city=${city || 'all'}, branchId=${branchId || 'all'})`);
    res.json({ success: true, data: cars, count: cars.length });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/cars/:id
const getCarById = async (req, res, next) => {
  try {
    const car = await prisma.car.findUnique({ 
      where: { id: req.params.id },
      include: { branch: true }
    });
    if (!car) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Car not found' });
    }
    res.json({ success: true, data: car });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cars  [Admin]
const createCar = async (req, res, next) => {
  try {
    const { name, brand, model, type, pricePerDay, seats, transmission, fuelType, description, branchId } = req.body;
    let { imageUrl } = req.body;
    
    if (req.file) {
      const { uploadToCloudinary } = require('../utils/cloudinary');
      try {
        const result = await uploadToCloudinary(req.file.buffer, 'driveeasy_cars');
        imageUrl = result.secure_url;
      } catch (uploadError) {
        return res.status(500).json({ success: false, error: 'UPLOAD_FAILED', message: 'Failed to upload car image.' });
      }
    }

    const car = await prisma.car.create({
      data: {
        name,
        brand,
        model,
        type,
        pricePerDay: parseFloat(pricePerDay),
        seats: parseInt(seats) || 5,
        transmission: transmission || 'manual',
        fuelType: fuelType || 'petrol',
        description,
        imageUrl: imageUrl || null,
        branchId: branchId ? branchId : null,
      },
    });

    res.status(201).json({ success: true, message: 'Car added successfully', data: car });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/cars/:id  [Admin]
const updateCar = async (req, res, next) => {
  try {
    const { name, brand, model, type, pricePerDay, availability, seats, transmission, fuelType, description, branchId } = req.body;
    let { imageUrl } = req.body;
    
    const existingCar = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (!existingCar) return res.status(404).json({ success: false, message: 'Car not found' });

    if (req.file) {
      const { uploadToCloudinary, deleteFromCloudinary } = require('../utils/cloudinary');
      try {
        const result = await uploadToCloudinary(req.file.buffer, 'driveeasy_cars');
        imageUrl = result.secure_url;
        
        // Delete old image if one existed
        if (existingCar.imageUrl && existingCar.imageUrl.includes('cloudinary')) {
          await deleteFromCloudinary(existingCar.imageUrl);
        }
      } catch (uploadError) {
        return res.status(500).json({ success: false, error: 'UPLOAD_FAILED', message: 'Failed to upload new car image.' });
      }
    }

    const car = await prisma.car.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(brand !== undefined && { brand }),
        ...(model !== undefined && { model }),
        ...(type !== undefined && { type }),
        ...(pricePerDay !== undefined && { pricePerDay: parseFloat(pricePerDay) }),
        ...(availability !== undefined && { availability: String(availability) === 'true' }),
        ...(seats !== undefined && { seats: parseInt(seats) }),
        ...(transmission !== undefined && { transmission }),
        ...(fuelType !== undefined && { fuelType }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(branchId !== undefined && { branchId: branchId || null }),
      },
    });

    res.json({ success: true, message: 'Car updated successfully', data: car });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cars/:id  [Admin]
const deleteCar = async (req, res, next) => {
  try {
    const car = await prisma.car.findUnique({ where: { id: req.params.id } });
    if (car && car.imageUrl && car.imageUrl.includes('cloudinary')) {
      const { deleteFromCloudinary } = require('../utils/cloudinary');
      await deleteFromCloudinary(car.imageUrl);
    }
    
    await prisma.car.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Car deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getCars, getCarById, createCar, updateCar, deleteCar };
