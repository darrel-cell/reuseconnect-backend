// Migrate asset categories from tenant-specific to global
// This script will:
// 1. Merge all tenant-specific categories into global ones
// 2. Update all references
// 3. Remove tenantId dependency
import prisma from './src/config/database';

async function migrateToGlobal() {
  console.log('🔄 Migrating asset categories to global (shared by all tenants)...\n');

  try {
    // Required global categories
    const requiredCategories = [
      { name: 'Networking', icon: '📡', co2ePerUnit: 100, avgWeight: 1.0, avgBuybackValue: 45 },
      { name: 'Server', icon: '🖥️', co2ePerUnit: 500, avgWeight: 20.0, avgBuybackValue: 300 },
      { name: 'Storage', icon: '💾', co2ePerUnit: 200, avgWeight: 2.0, avgBuybackValue: 100 },
      { name: 'Laptop', icon: '💻', co2ePerUnit: 250, avgWeight: 2.5, avgBuybackValue: 150 },
      { name: 'Desktop', icon: '🖥️', co2ePerUnit: 300, avgWeight: 8.0, avgBuybackValue: 80 },
      { name: 'Smart Phones', icon: '📱', co2ePerUnit: 60, avgWeight: 0.2, avgBuybackValue: 30 },
      { name: 'Tablets', icon: '📱', co2ePerUnit: 80, avgWeight: 0.5, avgBuybackValue: 50 },
    ];

    // Get all existing categories
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: { createdAt: 'asc' },
    });

    console.log(`📊 Found ${allCategories.length} existing categories`);

    // Group by name to find duplicates across tenants
    const categoriesByName = new Map<string, typeof allCategories>();
    for (const cat of allCategories) {
      if (!categoriesByName.has(cat.name)) {
        categoriesByName.set(cat.name, []);
      }
      categoriesByName.get(cat.name)!.push(cat);
    }

    console.log(`📋 Found ${categoriesByName.size} unique category names\n`);

    // Create global categories map (name -> category to keep)
    const globalCategories = new Map<string, typeof allCategories[0]>();

    // Process each category name
    for (const [categoryName, duplicates] of categoriesByName.entries()) {
      const required = requiredCategories.find(c => c.name === categoryName);
      
      if (required) {
        // This is a required category - keep the oldest one, update it to match spec
        const toKeep = duplicates[0];
        
        // Update the category to match required spec (in case values differ)
        await prisma.assetCategory.update({
          where: { id: toKeep.id },
          data: {
            icon: required.icon,
            co2ePerUnit: required.co2ePerUnit,
            avgWeight: required.avgWeight,
            avgBuybackValue: required.avgBuybackValue,
          },
        });

        globalCategories.set(categoryName, toKeep);

        // Update references for all duplicates to point to the kept one
        if (duplicates.length > 1) {
          console.log(`🔄 "${categoryName}": Keeping oldest, merging ${duplicates.length - 1} duplicates`);
          
          for (let i = 1; i < duplicates.length; i++) {
            const duplicate = duplicates[i];
            
            // Update BookingAsset references
            await prisma.bookingAsset.updateMany({
              where: { categoryId: duplicate.id },
              data: { 
                categoryId: toKeep.id,
                categoryName: toKeep.name,
              },
            });

            // Update JobAsset references
            await prisma.jobAsset.updateMany({
              where: { categoryId: duplicate.id },
              data: { 
                categoryId: toKeep.id,
                categoryName: toKeep.name,
              },
            });

            // Delete the duplicate
            await prisma.assetCategory.delete({
              where: { id: duplicate.id },
            });
          }
        } else {
          console.log(`✅ "${categoryName}": Already unique`);
        }
      } else {
        // Not a required category - need to handle references and delete
        console.log(`🗑️  "${categoryName}": Not required, will delete after updating references`);
        
        // Find a replacement category (use first required category)
        const replacement = globalCategories.values().next().value || 
                          (await prisma.assetCategory.findFirst({
                            where: { name: { in: requiredCategories.map(c => c.name) } },
                          }));

        if (replacement) {
          for (const cat of duplicates) {
            // Update references
            await prisma.bookingAsset.updateMany({
              where: { categoryId: cat.id },
              data: { 
                categoryId: replacement.id,
                categoryName: replacement.name,
              },
            });

            await prisma.jobAsset.updateMany({
              where: { categoryId: cat.id },
              data: { 
                categoryId: replacement.id,
                categoryName: replacement.name,
              },
            });

            // Delete
            await prisma.assetCategory.delete({
              where: { id: cat.id },
            });
          }
        }
      }
    }

    // Create any missing required categories
    const existingNames = new Set(Array.from(globalCategories.keys()));
    const missing = requiredCategories.filter(c => !existingNames.has(c.name));

    if (missing.length > 0) {
      console.log(`\n➕ Creating ${missing.length} missing categories...`);
      for (const missingCat of missing) {
        await prisma.assetCategory.create({
          data: missingCat,
        });
        console.log(`   ✅ Created "${missingCat.name}"`);
      }
    }

    // Final verification
    console.log(`\n📋 Final verification:`);
    const finalCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });

    console.log(`   Total global categories: ${finalCategories.length}`);
    console.log(`   Expected: 7`);
    
    if (finalCategories.length === 7) {
      console.log(`   ✅ Perfect! All 7 categories:`);
      finalCategories.forEach(cat => {
        console.log(`      - ${cat.name} (${cat.icon})`);
      });
    } else {
      console.log(`   ⚠️  Expected 7, found ${finalCategories.length}`);
    }

    console.log('\n✅ Migration complete!');
    console.log('\n⚠️  IMPORTANT: You need to run a database migration to remove tenantId column:');
    console.log('   1. The schema has been updated (tenantId removed)');
    console.log('   2. Run: npx prisma migrate dev --name remove_tenant_from_categories');
    console.log('   3. Or manually remove tenantId column from AssetCategory table');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateToGlobal().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

