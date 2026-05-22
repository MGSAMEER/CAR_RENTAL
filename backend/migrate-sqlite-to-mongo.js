const sqlite3 = require('sqlite3').verbose();
const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Initialize Prisma (now configured for MongoDB)
const prisma = new PrismaClient();

// Connect to the old SQLite database
const dbPath = path.resolve(__dirname, 'prisma', 'dev.db');
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Could not connect to SQLite database. Ensure dev.db exists in the prisma folder.');
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database.');
});

// Helper function to read a table from SQLite
const readTable = (tableName) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function runMigration() {
  try {
    console.log('🚀 Starting SQLite to MongoDB migration...');

    // 1. Read all data from SQLite
    console.log('📖 Reading data from SQLite...');
    const users = await readTable('users');
    const branches = await readTable('branches');
    const cars = await readTable('cars');
    const bookings = await readTable('bookings');
    const sessions = await readTable('sessions');
    const reviews = await readTable('reviews');
    const driverDocs = await readTable('driver_documents');

    console.log(`📊 Found:
    - ${users.length} Users
    - ${branches.length} Branches
    - ${cars.length} Cars
    - ${bookings.length} Bookings
    - ${sessions.length} Sessions
    - ${reviews.length} Reviews
    - ${driverDocs.length} Driver Documents`);

    // 2. Clear MongoDB collections (to prevent duplicate key errors if run multiple times)
    console.log('🧹 Clearing existing MongoDB collections...');
    await prisma.driverDocument.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.car.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});

    // 3. Insert into MongoDB sequentially to respect foreign key constraints
    // Wait, MongoDB doesn't enforce FKs rigidly like SQL, but Prisma relations rely on them.
    console.log('💾 Writing data to MongoDB...');

    // Users
    if (users.length > 0) {
      await prisma.user.createMany({
        data: users.map(u => ({
          ...u,
          googleId: u.googleId || undefined,
          isBlocked: Boolean(u.isBlocked),
          isEmailVerified: Boolean(u.isEmailVerified),
          createdAt: new Date(u.createdAt),
          updatedAt: new Date(u.updatedAt),
          emailVerificationExpires: u.emailVerificationExpires ? new Date(u.emailVerificationExpires) : undefined,
          resetPasswordExpires: u.resetPasswordExpires ? new Date(u.resetPasswordExpires) : undefined,
        }))
      });
      console.log('✅ Users migrated.');
    }

    // Branches
    if (branches.length > 0) {
      await prisma.branch.createMany({
        data: branches.map(b => ({
          ...b,
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
        }))
      });
      console.log('✅ Branches migrated.');
    }

    // Cars
    if (cars.length > 0) {
      await prisma.car.createMany({
        data: cars.map(c => ({
          ...c,
          availability: Boolean(c.availability),
          pricePerDay: parseFloat(c.pricePerDay),
          ratingAvg: c.ratingAvg ? parseFloat(c.ratingAvg) : null,
          createdAt: new Date(c.createdAt),
          updatedAt: new Date(c.updatedAt),
        }))
      });
      console.log('✅ Cars migrated.');
    }

    // Bookings
    if (bookings.length > 0) {
      await prisma.booking.createMany({
        data: bookings.map(b => ({
          ...b,
          stripeIntentId: b.stripeIntentId || undefined,
          totalCost: parseFloat(b.totalCost),
          startDate: new Date(b.startDate),
          endDate: new Date(b.endDate),
          createdAt: new Date(b.createdAt),
          updatedAt: new Date(b.updatedAt),
        }))
      });
      console.log('✅ Bookings migrated.');
    }

    // Sessions
    if (sessions.length > 0) {
      await prisma.session.createMany({
        data: sessions.map(s => ({
          ...s,
          expiresAt: new Date(s.expiresAt),
          createdAt: new Date(s.createdAt),
          updatedAt: new Date(s.updatedAt),
        }))
      });
      console.log('✅ Sessions migrated.');
    }

    // Reviews
    if (reviews.length > 0) {
      await prisma.review.createMany({
        data: reviews.map(r => ({
          ...r,
          createdAt: new Date(r.createdAt),
        }))
      });
      console.log('✅ Reviews migrated.');
    }

    // Driver Documents
    if (driverDocs.length > 0) {
      await prisma.driverDocument.createMany({
        data: driverDocs.map(d => ({
          ...d,
          licenseExpiry: new Date(d.licenseExpiry),
          createdAt: new Date(d.createdAt),
          updatedAt: new Date(d.updatedAt),
        }))
      });
      console.log('✅ Driver Documents migrated.');
    }

    console.log('🎉 Migration completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    db.close();
  }
}

runMigration();
