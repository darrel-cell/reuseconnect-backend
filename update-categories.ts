// Script to update asset categories to simplified list
import prisma from './src/config/database';

async function updateCategories() {
  console.log('🔄 Updating asset categories...');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    
    if (tenants.length === 0) {
      console.log('⚠️  No tenants found. Run seed-data.ts first.');
      await prisma.$disconnect();
      return;
    }

    // New simplified categories
    const newCategories = [
      {
        name: 'Networking',
        icon: '📡',
        co2ePerUnit: 100,
        avgWeight: 1.0,
        avgBuybackValue: 45,
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

    // Asset categories are now global - process once for all tenants
    console.log(`\n📦 Processing global categories (shared by all tenants)`);

    // Delete all existing categories
    const deleted = await prisma.assetCategory.deleteMany({});
    console.log(`   Deleted ${deleted.count} old categories`);

    // Create new global categories
    for (const category of newCategories) {
      await prisma.assetCategory.create({
        data: category, // No tenantId - categories are global
      });
    }
    console.log(`   ✅ Created ${newCategories.length} global categories`);

    console.log('\n✅ Category update complete!');
  } catch (error) {
    console.error('❌ Update failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateCategories().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

