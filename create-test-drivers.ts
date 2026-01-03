// Script to create test drivers with vehicle profiles
import prisma from './src/config/database';
import { hashPassword } from './src/utils/password';

async function createTestDrivers() {
  console.log('🚗 Creating test drivers...\n');

  // Get or create tenant (assuming 'reuse' tenant exists)
  let tenant = await prisma.tenant.findFirst({
    where: { slug: 'reuse' },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: 'Reuse ITAD Platform',
        slug: 'reuse',
        primaryColor: '168, 70%, 35%',
        accentColor: '168, 60%, 45%',
        theme: 'auto',
      },
    });
    console.log('✅ Created tenant');
  }

  const drivers = [
    {
      name: 'James Wilson',
      email: 'james.wilson@driver.test',
      password: 'driver123',
      phone: '+44 7700 900001',
      vehicleReg: 'AB12 CDE',
      vehicleType: 'van',
      vehicleFuelType: 'diesel',
    },
    {
      name: 'Sarah Chen',
      email: 'sarah.chen@driver.test',
      password: 'driver123',
      phone: '+44 7700 900002',
      vehicleReg: 'XY34 FGH',
      vehicleType: 'truck',
      vehicleFuelType: 'diesel',
    },
    {
      name: 'Mike Thompson',
      email: 'mike.thompson@driver.test',
      password: 'driver123',
      phone: '+44 7700 900003',
      vehicleReg: 'CD56 IJK',
      vehicleType: 'truck',
      vehicleFuelType: 'petrol',
    },
  ];

  const credentials: Array<{ name: string; email: string; password: string }> = [];

  for (const driverData of drivers) {
    // Check if driver already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: driverData.email },
      include: { driverProfile: true },
    });

    if (existingUser) {
      console.log(`⚠️  Driver ${driverData.name} already exists (${driverData.email})`);
      
      // Update vehicle profile if it doesn't exist
      if (!existingUser.driverProfile) {
        await prisma.driverProfile.create({
          data: {
            userId: existingUser.id,
            vehicleReg: driverData.vehicleReg,
            vehicleType: driverData.vehicleType,
            vehicleFuelType: driverData.vehicleFuelType,
          },
        });
        console.log(`   ✅ Added vehicle profile`);
      }
      
      credentials.push({
        name: driverData.name,
        email: driverData.email,
        password: '*** (already exists, password unchanged)',
      });
      continue;
    }

    // Hash password
    const hashedPassword = await hashPassword(driverData.password);

    // Create driver user
    const newUser = await prisma.user.create({
      data: {
        email: driverData.email,
        name: driverData.name,
        password: hashedPassword,
        role: 'driver',
        status: 'active',
        tenantId: tenant.id,
        phone: driverData.phone,
      },
    });

    // Create driver profile
    await prisma.driverProfile.create({
      data: {
        userId: newUser.id,
        vehicleReg: driverData.vehicleReg,
        vehicleType: driverData.vehicleType,
        vehicleFuelType: driverData.vehicleFuelType,
      },
    });

    console.log(`✅ Created driver: ${driverData.name}`);
    console.log(`   Email: ${driverData.email}`);
    console.log(`   Vehicle: ${driverData.vehicleReg} (${driverData.vehicleType}, ${driverData.vehicleFuelType})`);

    credentials.push({
      name: driverData.name,
      email: driverData.email,
      password: driverData.password,
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 DRIVER CREDENTIALS');
  console.log('='.repeat(60));
  console.log('\nAll drivers use the same password for testing:\n');
  console.log('Password: driver123\n');
  console.log('Individual credentials:');
  credentials.forEach((cred, index) => {
    console.log(`\n${index + 1}. ${cred.name}`);
    console.log(`   Email: ${cred.email}`);
    console.log(`   Password: ${cred.password}`);
  });
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test drivers created successfully!');
  console.log('='.repeat(60) + '\n');

  await prisma.$disconnect();
}

createTestDrivers().catch((error) => {
  console.error('❌ Failed to create test drivers:', error);
  process.exit(1);
});

