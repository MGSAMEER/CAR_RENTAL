const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createAdmin() {
  const password = 'Admin@123';
  const hashedPassword = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email: 'admin@driveeasy.com' } });
  if (existing) {
    // Update role to admin if already exists
    await prisma.user.update({ where: { email: 'admin@driveeasy.com' }, data: { role: 'admin' } });
    console.log('✅ Existing user promoted to admin!');
  } else {
    await prisma.user.create({
      data: {
        name: 'Super Admin',
        email: 'admin@driveeasy.com',
        password: hashedPassword,
        role: 'admin',
      },
    });
    console.log('✅ Admin user created!');
  }

  console.log('\n📋 Admin Credentials:');
  console.log('   Email   : admin@driveeasy.com');
  console.log('   Password: Admin@123');
  console.log('\n🔒 Login at http://localhost:3000/login');
}

createAdmin()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
