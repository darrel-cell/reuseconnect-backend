// Script to clean asset categories - keep only the 7 required categories
import prisma from './src/config/database';

async function cleanCategories() {
  console.log('🧹 Cleaning asset categories...');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    
    if (tenants.length === 0) {
      console.log('⚠️  No tenants found.');
      await prisma.$disconnect();
      return;
    }

    // Required categories (exact names)
    const requiredCategories = [
      'Networking',
      'Server',
      'Storage',
      'Laptop',
      'Desktop',
      'Smart Phones',
      'Tablets',
    ];

    for (const tenant of tenants) {
      console.log(`\n📦 Processing tenant: ${tenant.name}`);

      // Get all categories for this tenant
      const allCategories = await prisma.assetCategory.findMany({
        where: { tenantId: tenant.id },
      });

      console.log(`   Found ${allCategories.length} categories`);

      // Find categories that should be kept
      const categoriesToKeep = allCategories.filter(cat => 
        requiredCategories.includes(cat.name)
      );

      // Find categories to delete
      const categoriesToDelete = allCategories.filter(cat => 
        !requiredCategories.includes(cat.name)
      );

      if (categoriesToDelete.length > 0) {
        // Delete unwanted categories
        const deleted = await prisma.assetCategory.deleteMany({
          where: {
            tenantId: tenant.id,
            name: { notIn: requiredCategories },
          },
        });
        console.log(`   ✅ Deleted ${deleted.count} unwanted categories`);
      } else {
        console.log(`   ✅ No unwanted categories to delete`);
      }

      // Check if we have all required categories
      const existingNames = categoriesToKeep.map(c => c.name);
      const missingCategories = requiredCategories.filter(
        name => !existingNames.includes(name)
      );

      if (missingCategories.length > 0) {
        console.log(`   ⚠️  Missing categories: ${missingCategories.join(', ')}`);
        console.log(`   Run update-categories.ts to add missing categories`);
      } else {
        console.log(`   ✅ All required categories present`);
      }
    }

    console.log('\n✅ Category cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanCategories().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

