// Seed script to populate initial data
import prisma from './src/config/database';

async function seed() {
  console.log('🌱 Seeding database...');

  // Check if categories already exist (global categories - no tenant needed)
  const existingCategories = await prisma.assetCategory.findFirst();
  if (existingCategories) {
    console.log('⚠️  Asset categories already exist. Skipping seed.');
    await prisma.$disconnect();
    return;
  }

  // Create global asset categories (shared by all tenants)
  const categories = [
    {
      name: 'Networking',
      icon: '📡',
      co2ePerUnit: 100, // kg CO2e saved per unit reused
      avgWeight: 1.0, // kg
      avgBuybackValue: 45, // £
    },
    {
      name: 'Server',
      icon: '🖥️',
      co2ePerUnit: 500,
      avgWeight: 20.0,
      avgBuybackValue: 300,
    },
    {
      name: 'Storage',
      icon: '💾',
      co2ePerUnit: 200,
      avgWeight: 2.0,
      avgBuybackValue: 100,
    },
    {
      name: 'Laptop',
      icon: '💻',
      co2ePerUnit: 250,
      avgWeight: 2.5,
      avgBuybackValue: 150,
    },
    {
      name: 'Desktop',
      icon: '🖥️',
      co2ePerUnit: 300,
      avgWeight: 8.0,
      avgBuybackValue: 80,
    },
    {
      name: 'Smart Phones',
      icon: '📱',
      co2ePerUnit: 60,
      avgWeight: 0.2,
      avgBuybackValue: 30,
    },
    {
      name: 'Tablets',
      icon: '📱',
      co2ePerUnit: 80,
      avgWeight: 0.5,
      avgBuybackValue: 50,
    },
  ];

  for (const category of categories) {
    await prisma.assetCategory.create({
      data: category, // No tenantId - categories are global
    });
  }

  console.log(`✅ Created ${categories.length} asset categories`);

  await prisma.$disconnect();
  console.log('✅ Seeding complete!');
}

seed().catch((error) => {
  console.error('❌ Seeding failed:', error);
  process.exit(1);
});

