const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, '../prisma/dev.db');
const exportPath = path.resolve(__dirname, 'data.json');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Could not connect to SQLite database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite database.');
});

const readTable = (tableName) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function exportData() {
  try {
    console.log('📖 Reading data from SQLite...');
    const users = await readTable('users');
    const branches = await readTable('branches');
    const cars = await readTable('cars');
    const bookings = await readTable('bookings');
    const sessions = await readTable('sessions');
    const reviews = await readTable('reviews');
    const driverDocs = await readTable('driver_documents');

    const data = {
      users,
      branches,
      cars,
      bookings,
      sessions,
      reviews,
      driverDocs,
    };

    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Data exported successfully to ${exportPath}`);
    console.log(`📊 Exported:
    - ${users.length} Users
    - ${branches.length} Branches
    - ${cars.length} Cars
    - ${bookings.length} Bookings
    - ${sessions.length} Sessions
    - ${reviews.length} Reviews
    - ${driverDocs.length} Driver Documents`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Export failed:', err);
    process.exit(1);
  }
}

exportData();
