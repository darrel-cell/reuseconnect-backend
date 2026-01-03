// Force clean: Remove ALL categories and recreate exactly 7 for each tenant
import prisma from './src/config/database';

async function forceClean() {
  console.log('🧹 Force cleaning asset categories...\n');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    
    if (tenants.length === 0) {
      console.log('⚠️  No tenants found.');
      await prisma.$disconnect();
      return;
    }

    // Required categories with exact specifications
    const requiredCategories = [
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

    for (const tenant of tenants) {
      console.log(`\n📦 Processing tenant: ${tenant.name}`);

      // Count existing categories
      const existingCount = await prisma.assetCategory.count({
        where: { tenantId: tenant.id },
      });

      console.log(`   Found ${existingCount} existing categories`);

      // Delete ALL categories for this tenant
      const deleted = await prisma.assetCategory.deleteMany({
        where: { tenantId: tenant.id },
      });
      console.log(`   🗑️  Deleted ${deleted.count} categories`);

      // Create exactly 7 categories
      for (const category of requiredCategories) {
        await prisma.assetCategory.create({
          data: {
            tenantId: tenant.id,
            ...category,
          },
        });
      }
      console.log(`   ✅ Created exactly 7 categories`);

      // Verify
      const finalCount = await prisma.assetCategory.count({
        where: { tenantId: tenant.id },
      });
      const finalCategories = await prisma.assetCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      });

      console.log(`   📋 Verification: ${finalCount} categories`);
      finalCategories.forEach(cat => {
        console.log(`      - ${cat.name} (${cat.icon})`);
      });
    }

    // Final summary
    console.log(`\n📊 Final Summary:`);
    const totalCategories = await prisma.assetCategory.count();
    console.log(`   Total categories in database: ${totalCategories}`);
    console.log(`   Expected: ${tenants.length * 7} (${tenants.length} tenants × 7 categories)`);
    
    if (totalCategories === tenants.length * 7) {
      console.log(`   ✅ Perfect! Exactly ${7} categories per tenant`);
    } else {
      console.log(`   ⚠️  Mismatch! Expected ${tenants.length * 7}, got ${totalCategories}`);
    }

    console.log('\n✅ Force cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

forceClean().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

