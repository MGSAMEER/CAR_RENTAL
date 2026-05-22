const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Replace with your actual MongoDB URI
const MONGO_URI = "mongodb+srv://chetannikam0403_db_user:eu2IX59uZ5O1S7qH@driveeasy.5qrkugq.mongodb.net/DriveEasyDB?retryWrites=true&w=majority&appName=DriveEasy";
const dataPath = path.resolve(__dirname, 'data.json');

async function importData() {
  if (!fs.existsSync(dataPath)) {
    console.error('❌ Error: data.json not found. Run export-sqlite.js first.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataPath);
  const data = JSON.parse(rawData);

  const client = new MongoClient(MONGO_URI);

  try {
    console.log('🚀 Connecting to MongoDB Atlas...');
    await client.connect();
    const db = client.db('DriveEasyDB');
    console.log('✅ Connected to MongoDB Atlas.');

    // Helper function to insert data safely
    const insertCollection = async (collectionName, items, mapFunction) => {
      if (!items || items.length === 0) return;
      const collection = db.collection(collectionName);
      
      // Idempotency: Clear existing records to prevent duplicate key conflicts
      await collection.deleteMany({});
      
      try {
        await collection.dropIndexes();
        console.log(`🧹 Dropped indexes for ${collectionName}`);
      } catch (e) {
        // Ignore if no indexes exist
      }
      
      // Map data 
      let mappedItems = items.map(mapFunction);

      // Strict deduplication for Users to prevent E11000 errors
      if (collectionName === 'users') {
        const seenEmails = new Set();
        const seenGoogleIds = new Set();
        mappedItems = mappedItems.filter(u => {
          if (seenEmails.has(u.email)) return false; // Skip duplicate emails
          seenEmails.add(u.email);
          
          if (u.googleId) {
             if (seenGoogleIds.has(u.googleId)) return false;
             seenGoogleIds.add(u.googleId);
          }
          return true;
        });
      }

      await collection.insertMany(mappedItems);
      console.log(`✅ Inserted ${mappedItems.length} records into ${collectionName}`);
    };

    console.log('💾 Starting import...');

    await insertCollection('users', data.users, u => {
      // Safely parse googleId to prevent "null" strings or empty spaces triggering sparse indexes
      const cleanGoogleId = (u.googleId && u.googleId.trim() !== '' && u.googleId !== 'null') ? u.googleId.trim() : undefined;
      
      return {
        _id: u.id,
        name: u.name,
        email: u.email,
        password: u.password,
        // Omit googleId entirely if missing to satisfy MongoDB sparse index rules
        ...(cleanGoogleId ? { googleId: cleanGoogleId } : {}),
        avatar: u.avatar,
        authProvider: u.authProvider,
        role: u.role,
        isBlocked: Boolean(u.isBlocked),
        isEmailVerified: Boolean(u.isEmailVerified),
        emailVerificationToken: u.emailVerificationToken,
        emailVerificationExpires: u.emailVerificationExpires ? new Date(u.emailVerificationExpires) : null,
        resetPasswordToken: u.resetPasswordToken,
        resetPasswordExpires: u.resetPasswordExpires ? new Date(u.resetPasswordExpires) : null,
        createdAt: new Date(u.createdAt),
        updatedAt: new Date(u.updatedAt)
      };
    });

    await insertCollection('branches', data.branches, b => ({
      _id: b.id,
      name: b.name,
      address: b.address,
      city: b.city,
      latitude: parseFloat(b.latitude),
      longitude: parseFloat(b.longitude),
      contactNumber: b.contactNumber,
      createdAt: new Date(b.createdAt),
      updatedAt: new Date(b.updatedAt)
    }));

    await insertCollection('cars', data.cars, c => ({
      _id: c.id,
      name: c.name,
      brand: c.brand,
      model: c.model,
      type: c.type,
      pricePerDay: parseFloat(c.pricePerDay),
      availability: Boolean(c.availability),
      imageUrl: c.imageUrl,
      description: c.description,
      seats: parseInt(c.seats),
      transmission: c.transmission,
      fuelType: c.fuelType,
      ratingAvg: c.ratingAvg ? parseFloat(c.ratingAvg) : null,
      reviewCount: parseInt(c.reviewCount),
      branchId: c.branchId,
      createdAt: new Date(c.createdAt),
      updatedAt: new Date(c.updatedAt)
    }));

    await insertCollection('bookings', data.bookings, b => {
      const cleanStripeId = (b.stripeIntentId && b.stripeIntentId.trim() !== '' && b.stripeIntentId !== 'null') ? b.stripeIntentId.trim() : undefined;
      
      return {
        _id: b.id,
        userId: b.userId,
        carId: b.carId,
        startDate: new Date(b.startDate),
        endDate: new Date(b.endDate),
        totalCost: parseFloat(b.totalCost),
        status: b.status,
        paymentStatus: b.paymentStatus,
        ...(cleanStripeId ? { stripeIntentId: cleanStripeId } : {}),
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt)
      };
    });

    await insertCollection('sessions', data.sessions, s => ({
      _id: s.id,
      userId: s.userId,
      refreshToken: s.refreshToken,
      expiresAt: new Date(s.expiresAt),
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt)
    }));

    await insertCollection('reviews', data.reviews, r => ({
      _id: r.id,
      rating: parseInt(r.rating),
      comment: r.comment,
      carId: r.carId,
      userId: r.userId,
      createdAt: new Date(r.createdAt)
    }));

    await insertCollection('driver_documents', data.driverDocs, d => ({
      _id: d.id,
      userId: d.userId,
      licenseNumber: d.licenseNumber,
      licenseExpiry: new Date(d.licenseExpiry),
      documentUrl: d.documentUrl,
      verificationStatus: d.verificationStatus,
      createdAt: new Date(d.createdAt),
      updatedAt: new Date(d.updatedAt)
    }));

    console.log('🎉 Migration to MongoDB completed successfully!');

  } catch (err) {
    console.error('❌ Import failed:', err);
  } finally {
    await client.close();
  }
}

importData();
