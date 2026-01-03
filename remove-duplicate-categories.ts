// Script to remove duplicate asset categories and keep only 7 unique ones
import prisma from './src/config/database';

async function removeDuplicates() {
  console.log('🧹 Removing duplicate asset categories...');

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
        orderBy: { createdAt: 'asc' }, // Keep the oldest one
      });

      console.log(`   Found ${allCategories.length} total categories`);

      // Group by name to find duplicates
      const categoriesByName = new Map<string, typeof allCategories>();
      
      for (const category of allCategories) {
        if (!categoriesByName.has(category.name)) {
          categoriesByName.set(category.name, []);
        }
        categoriesByName.get(category.name)!.push(category);
      }

      // Process each category name
      let totalDeleted = 0;
      let totalKept = 0;

      for (const [categoryName, duplicates] of categoriesByName.entries()) {
        if (requiredCategories.includes(categoryName)) {
          // This is a required category - keep the first one, delete the rest
          if (duplicates.length > 1) {
            const toKeep = duplicates[0]; // Keep the oldest
            const toDelete = duplicates.slice(1); // Delete the rest
            
            for (const duplicate of toDelete) {
              await prisma.assetCategory.delete({
                where: { id: duplicate.id },
              });
            }
            
            console.log(`   ✅ "${categoryName}": Kept 1, deleted ${toDelete.length} duplicates`);
            totalKept += 1;
            totalDeleted += toDelete.length;
          } else {
            console.log(`   ✅ "${categoryName}": Already unique`);
            totalKept += 1;
          }
        } else {
          // This is NOT a required category - delete all
          for (const category of duplicates) {
            await prisma.assetCategory.delete({
              where: { id: category.id },
            });
          }
          console.log(`   🗑️  "${categoryName}": Deleted ${duplicates.length} (not in required list)`);
          totalDeleted += duplicates.length;
        }
      }

      console.log(`   📊 Summary: Kept ${totalKept} categories, Deleted ${totalDeleted} duplicates/unwanted`);

      // Verify final state
      const finalCategories = await prisma.assetCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      });

      console.log(`   📋 Final categories (${finalCategories.length}):`);
      finalCategories.forEach(cat => {
        console.log(`      - ${cat.name} (${cat.icon || 'no icon'})`);
      });

      // Check if we have all required categories
      const finalNames = finalCategories.map(c => c.name);
      const missing = requiredCategories.filter(name => !finalNames.includes(name));
      
      if (missing.length > 0) {
        console.log(`   ⚠️  Missing categories: ${missing.join(', ')}`);
        console.log(`   💡 Run update-categories.ts to add missing categories`);
      } else {
        console.log(`   ✅ All 7 required categories present`);
      }
    }

    console.log('\n✅ Duplicate removal complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

removeDuplicates().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

