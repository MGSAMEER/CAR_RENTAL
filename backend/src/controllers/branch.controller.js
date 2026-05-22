const { prisma } = require('../config/database');

/**
 * Haversine formula — calculates distance between two lat/lng points in km.
 * Used for nearest-branch allocation and distance-sorted car listing.
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/v1/branches
const getBranches = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    const branches = await prisma.branch.findMany({
      include: {
        _count: { select: { cars: true } },
      },
      orderBy: { name: 'asc' },
    });

    // If user provides location, attach distance and sort by nearest
    if (lat && lng) {
      const userLat = parseFloat(lat);
      const userLng = parseFloat(lng);

      const withDistance = branches.map((b) => ({
        ...b,
        distanceKm: parseFloat(
          haversineDistanceKm(userLat, userLng, b.latitude, b.longitude).toFixed(1)
        ),
      }));

      withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
      return res.json({ success: true, data: withDistance, userLocated: true });
    }

    res.json({ success: true, data: branches, userLocated: false });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/branches/nearest?lat=&lng=
const getNearestBranch = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'lat and lng query parameters are required',
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);

    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ success: false, message: 'Invalid coordinates provided' });
    }

    const branches = await prisma.branch.findMany({
      include: { _count: { select: { cars: true } } },
    });

    if (!branches.length) {
      return res.status(404).json({ success: false, message: 'No branches found' });
    }

    // Find nearest branch using Haversine
    let nearest = null;
    let minDistance = Infinity;

    for (const branch of branches) {
      const dist = haversineDistanceKm(userLat, userLng, branch.latitude, branch.longitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = branch;
      }
    }

    res.json({
      success: true,
      data: {
        ...nearest,
        distanceKm: parseFloat(minDistance.toFixed(1)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/branches/:id
const getBranchById = async (req, res, next) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: req.params.id },
      include: {
        cars: {
          where: { availability: true },
          select: { id: true, name: true, brand: true, type: true, pricePerDay: true, imageUrl: true, availability: true },
        },
        _count: { select: { cars: true } },
      },
    });
    if (!branch) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Branch not found' });
    }
    res.json({ success: true, data: branch });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/branches [Admin]
const createBranch = async (req, res, next) => {
  try {
    const { name, address, city, latitude, longitude, contactNumber } = req.body;

    if (!name || !address || !city || latitude === undefined || longitude === undefined || !contactNumber) {
      return res.status(400).json({ success: false, message: 'All branch fields are required' });
    }

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        city,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        contactNumber,
      },
    });

    res.status(201).json({ success: true, message: 'Branch created successfully', data: branch });
  } catch (error) {
    next(error);
  }
};

// PUT /api/v1/branches/:id [Admin]
const updateBranch = async (req, res, next) => {
  try {
    const { name, address, city, latitude, longitude, contactNumber } = req.body;

    const branch = await prisma.branch.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(address && { address }),
        ...(city && { city }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) }),
        ...(contactNumber && { contactNumber }),
      },
    });

    res.json({ success: true, message: 'Branch updated successfully', data: branch });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/branches/:id [Admin]
const deleteBranch = async (req, res, next) => {
  try {
    await prisma.branch.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Branch deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBranches,
  getBranchById,
  getNearestBranch,
  createBranch,
  updateBranch,
  deleteBranch,
  haversineDistanceKm, // exported for use in booking controller
};
