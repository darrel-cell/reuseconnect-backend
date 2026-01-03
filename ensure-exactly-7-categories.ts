// Ensure exactly 7 categories per tenant - remove all duplicates and extras
import prisma from './src/config/database';

async function ensureExactly7() {
  console.log('🎯 Ensuring exactly 7 categories per tenant...\n');

  try {
    // Required categories with exact specifications
    const requiredCategories = [
      { name: 'Networking', icon: '📡', co2ePerUnit: 100, avgWeight: 1.0, avgBuybackValue: 45 },
      { name: 'Server', icon: '🖥️', co2ePerUnit: 500, avgWeight: 20.0, avgBuybackValue: 300 },
      { name: 'Storage', icon: '💾', co2ePerUnit: 200, avgWeight: 2.0, avgBuybackValue: 100 },
      { name: 'Laptop', icon: '💻', co2ePerUnit: 250, avgWeight: 2.5, avgBuybackValue: 150 },
      { name: 'Desktop', icon: '🖥️', co2ePerUnit: 300, avgWeight: 8.0, avgBuybackValue: 80 },
      { name: 'Smart Phones', icon: '📱', co2ePerUnit: 60, avgWeight: 0.2, avgBuybackValue: 30 },
      { name: 'Tablets', icon: '📱', co2ePerUnit: 80, avgWeight: 0.5, avgBuybackValue: 50 },
    ];

    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    
    if (tenants.length === 0) {
      console.log('⚠️  No tenants found.');
      await prisma.$disconnect();
      return;
    }

    for (const tenant of tenants) {
      console.log(`\n📦 Processing tenant: ${tenant.name}`);

      // Get all categories for this tenant
      const allCategories = await prisma.assetCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'asc' },
      });

      console.log(`   Found ${allCategories.length} categories`);

      // Group by name to find duplicates
      const byName = new Map<string, typeof allCategories>();
      for (const cat of allCategories) {
        if (!byName.has(cat.name)) {
          byName.set(cat.name, []);
        }
        byName.get(cat.name)!.push(cat);
      }

      // Process each category name
      const categoriesToKeep = new Map<string, typeof allCategories[0]>();
      const categoriesToDelete: string[] = [];

      for (const [categoryName, duplicates] of byName.entries()) {
        if (requiredCategories.some(c => c.name === categoryName)) {
          // Required category - keep the oldest one
          const toKeep = duplicates[0];
          categoriesToKeep.set(categoryName, toKeep);
          
          // Mark others for deletion (after updating references)
          for (let i = 1; i < duplicates.length; i++) {
            categoriesToDelete.push(duplicates[i].id);
          }
          
          if (duplicates.length > 1) {
            console.log(`   ⚠️  "${categoryName}": ${duplicates.length} found - will merge duplicates`);
          }
        } else {
          // Not required - mark all for deletion
          console.log(`   🗑️  "${categoryName}": Not required - will delete all (${duplicates.length})`);
          for (const cat of duplicates) {
            categoriesToDelete.push(cat.id);
          }
        }
      }

      // Update references for duplicates before deleting
      if (categoriesToDelete.length > 0) {
        console.log(`   🔄 Updating references for ${categoriesToDelete.length} categories to be deleted...`);
        
        for (const deleteId of categoriesToDelete) {
          const categoryToDelete = allCategories.find(c => c.id === deleteId);
          if (!categoryToDelete) continue;

          // Find the category to merge into (same name, required)
          const replacement = categoriesToKeep.get(categoryToDelete.name);
          
          if (replacement && replacement.id !== deleteId) {
            // Update BookingAsset references
            const bookingUpdated = await prisma.bookingAsset.updateMany({
              where: { categoryId: deleteId },
              data: { 
                categoryId: replacement.id,
                categoryName: replacement.name,
              },
            });

            // Update JobAsset references
            const jobUpdated = await prisma.jobAsset.updateMany({
              where: { categoryId: deleteId },
              data: { 
                categoryId: replacement.id,
                categoryName: replacement.name,
              },
            });

            if (bookingUpdated.count > 0 || jobUpdated.count > 0) {
              console.log(`      Updated ${bookingUpdated.count} booking assets, ${jobUpdated.count} job assets for "${categoryToDelete.name}"`);
            }
          } else {
            // No replacement found - try to use first required category
            const firstRequired = Array.from(categoriesToKeep.values())[0];
            if (firstRequired) {
              await prisma.bookingAsset.updateMany({
                where: { categoryId: deleteId },
                data: { 
                  categoryId: firstRequired.id,
                  categoryName: firstRequired.name,
                },
              });
              await prisma.jobAsset.updateMany({
                where: { categoryId: deleteId },
                data: { 
                  categoryId: firstRequired.id,
                  categoryName: firstRequired.name,
                },
              });
            }
          }
        }

        // Now delete the duplicates
        console.log(`   🗑️  Deleting ${categoriesToDelete.length} duplicate/unwanted categories...`);
        await prisma.assetCategory.deleteMany({
          where: { id: { in: categoriesToDelete } },
        });
        console.log(`   ✅ Deleted ${categoriesToDelete.length} categories`);
      }

      // Ensure all 7 required categories exist
      const remainingCategories = await prisma.assetCategory.findMany({
        where: { tenantId: tenant.id },
      });
      const remainingNames = new Set(remainingCategories.map(c => c.name));

      const missing = requiredCategories.filter(c => !remainingNames.has(c.name));
      
      if (missing.length > 0) {
        console.log(`   ➕ Creating ${missing.length} missing categories...`);
        for (const missingCat of missing) {
          await prisma.assetCategory.create({
            data: {
              tenantId: tenant.id,
              ...missingCat,
            },
          });
          console.log(`      ✅ Created "${missingCat.name}"`);
        }
      }

      // Final verification
      const finalCategories = await prisma.assetCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      });

      console.log(`   📋 Final state: ${finalCategories.length} categories`);
      if (finalCategories.length === 7) {
        console.log(`   ✅ Perfect! Exactly 7 categories:`);
        finalCategories.forEach(cat => {
          console.log(`      - ${cat.name} (${cat.icon})`);
        });
      } else {
        console.log(`   ⚠️  Expected 7, found ${finalCategories.length}`);
      }
    }

    // Final summary
    console.log(`\n📊 Final Summary:`);
    const totalCategories = await prisma.assetCategory.count();
    console.log(`   Total categories: ${totalCategories}`);
    console.log(`   Expected: ${tenants.length * 7} (${tenants.length} tenants × 7)`);
    
    if (totalCategories === tenants.length * 7) {
      console.log(`   ✅ Perfect!`);
    }

    console.log('\n✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

ensureExactly7().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

