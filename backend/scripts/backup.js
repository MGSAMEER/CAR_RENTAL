const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const BACKUP_DIR = path.join(__dirname, '../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(BACKUP_DIR, `mongodb-backup-${timestamp}.archive`);

const uri = process.env.DATABASE_URL;

if (!uri) {
  console.error('❌ DATABASE_URL is not set in .env. Backup aborted.');
  process.exit(1);
}

// Execute mongodump (Requires MongoDB Database Tools installed on the host)
const cmd = `mongodump --uri="${uri}" --archive="${backupFile}" --gzip`;

console.log(`⏳ Starting MongoDB backup to ${backupFile}...`);

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Backup failed: ${error.message}`);
    console.error('Make sure MongoDB Database Tools (mongodump) is installed and in your PATH.');
    return;
  }
  
  console.log(`✅ Backup successfully created!`);
  
  // Retention Policy: Keep only the 7 most recent backups
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('mongodb-backup-'))
      .sort((a, b) => b.localeCompare(a)); // Sort descending
      
    if (files.length > 7) {
      const filesToDelete = files.slice(7);
      filesToDelete.forEach(file => {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
        console.log(`🗑️ Deleted old backup to respect retention policy: ${file}`);
      });
    }
  } catch (err) {
    console.error(`⚠️ Failed to enforce retention policy: ${err.message}`);
  }
});
