// Script to create an admin user
import prisma from './src/config/database';
import { hashPassword } from './src/utils/password';

async function createAdmin() {
  console.log('👤 Creating admin user...');

  const email = 'admin@reuse.com';
  const password = 'admin123';
  const name = 'Admin User';
  const companyName = 'Reuse ITAD Platform';

  // Check if admin already exists
  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (existing) {
    console.log('⚠️  Admin user already exists.');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    await prisma.$disconnect();
    return;
  }

  // Get or create tenant
  let tenant = await prisma.tenant.findFirst({
    where: { slug: 'reuse' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: companyName,
        slug: 'reuse',
        primaryColor: '168, 70%, 35%',
        accentColor: '168, 60%, 45%',
        theme: 'auto',
      },
    });
    console.log('✅ Created tenant');
  }

  // Hash password
  const hashedPassword = await hashPassword(password);

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      role: 'admin',
      status: 'active',
      tenantId: tenant.id,
    },
  });

  console.log('✅ Admin user created!');
  console.log(`   Email: ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role: ${admin.role}`);
  console.log(`   Status: ${admin.status}`);

  await prisma.$disconnect();
}

createAdmin().catch((error) => {
  console.error('❌ Failed to create admin:', error);
  process.exit(1);
});

