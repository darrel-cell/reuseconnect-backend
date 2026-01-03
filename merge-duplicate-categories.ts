// Merge duplicate categories: Keep one of each name, update references, then delete duplicates
import prisma from './src/config/database';

async function mergeDuplicates() {
  console.log('🔄 Merging duplicate asset categories...\n');

  try {
    // Get all tenants
    const tenants = await prisma.tenant.findMany();
    
    if (tenants.length === 0) {
      console.log('⚠️  No tenants found.');
      await prisma.$disconnect();
      return;
    }

    // Required categories
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
        orderBy: { createdAt: 'asc' }, // Keep the oldest
      });

      console.log(`   Found ${allCategories.length} categories`);

      // Group by name
      const categoriesByName = new Map<string, typeof allCategories>();
      
      for (const category of allCategories) {
        if (!categoriesByName.has(category.name)) {
          categoriesByName.set(category.name, []);
        }
        categoriesByName.get(category.name)!.push(category);
      }

      let totalMerged = 0;
      let totalDeleted = 0;

      // Process each category name
      for (const [categoryName, duplicates] of categoriesByName.entries()) {
        if (duplicates.length > 1) {
          // Has duplicates - keep the first (oldest), merge others into it
          const toKeep = duplicates[0];
          const toMerge = duplicates.slice(1);

          console.log(`   🔄 "${categoryName}": ${duplicates.length} found - keeping oldest (${toKeep.id}), merging ${toMerge.length} duplicates`);

          // Update all BookingAsset references to point to the kept category
          for (const duplicate of toMerge) {
            // Update BookingAsset references
            const bookingAssetUpdated = await prisma.bookingAsset.updateMany({
              where: { categoryId: duplicate.id },
              data: { 
                categoryId: toKeep.id,
                categoryName: toKeep.name, // Also update the name field
              },
            });

            // Update JobAsset references
            const jobAssetUpdated = await prisma.jobAsset.updateMany({
              where: { categoryId: duplicate.id },
              data: { 
                categoryId: toKeep.id,
                categoryName: toKeep.name, // Also update the name field
              },
            });

            console.log(`      Updated ${bookingAssetUpdated.count} booking assets, ${jobAssetUpdated.count} job assets`);

            // Now safe to delete
            await prisma.assetCategory.delete({
              where: { id: duplicate.id },
            });

            totalMerged++;
            totalDeleted++;
          }
        } else if (!requiredCategories.includes(categoryName)) {
          // Not a required category and no duplicates - need to handle references first
          console.log(`   🗑️  "${categoryName}": Not in required list`);
          
          const category = duplicates[0];
          
          // Check if category is being used
          const bookingAssetCount = await prisma.bookingAsset.count({
            where: { categoryId: category.id },
          });
          const jobAssetCount = await prisma.jobAsset.count({
            where: { categoryId: category.id },
          });

          if (bookingAssetCount > 0 || jobAssetCount > 0) {
            // Category is in use - find a replacement (use first required category)
            const replacement = finalCategories.find(c => requiredCategories.includes(c.name));
            if (replacement) {
              console.log(`      Updating ${bookingAssetCount + jobAssetCount} references to "${replacement.name}"`);
              
              await prisma.bookingAsset.updateMany({
                where: { categoryId: category.id },
                data: { 
                  categoryId: replacement.id,
                  categoryName: replacement.name,
                },
              });
              
              await prisma.jobAsset.updateMany({
                where: { categoryId: category.id },
                data: { 
                  categoryId: replacement.id,
                  categoryName: replacement.name,
                },
              });
            } else {
              console.log(`      ⚠️  No replacement category found, skipping deletion`);
              continue;
            }
          }

          // Now safe to delete
          await prisma.assetCategory.delete({
            where: { id: category.id },
          });

          totalDeleted++;
        } else {
          console.log(`   ✅ "${categoryName}": Unique and required`);
        }
      }

      console.log(`   📊 Merged ${totalMerged} duplicates, deleted ${totalDeleted} unwanted`);

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
        console.log(`   💡 Creating missing categories...`);
        
        // Create missing categories
        const categorySpecs: Record<string, any> = {
          'Networking': { icon: '📡', co2ePerUnit: 100, avgWeight: 1.0, avgBuybackValue: 45 },
          'Server': { icon: '🖥️', co2ePerUnit: 500, avgWeight: 20.0, avgBuybackValue: 300 },
          'Storage': { icon: '💾', co2ePerUnit: 200, avgWeight: 2.0, avgBuybackValue: 100 },
          'Laptop': { icon: '💻', co2ePerUnit: 250, avgWeight: 2.5, avgBuybackValue: 150 },
          'Desktop': { icon: '🖥️', co2ePerUnit: 300, avgWeight: 8.0, avgBuybackValue: 80 },
          'Smart Phones': { icon: '📱', co2ePerUnit: 60, avgWeight: 0.2, avgBuybackValue: 30 },
          'Tablets': { icon: '📱', co2ePerUnit: 80, avgWeight: 0.5, avgBuybackValue: 50 },
        };

        for (const name of missing) {
          const spec = categorySpecs[name];
          if (spec) {
            await prisma.assetCategory.create({
              data: {
                tenantId: tenant.id,
                name,
                ...spec,
              },
            });
            console.log(`      ✅ Created "${name}"`);
          }
        }
      } else {
        console.log(`   ✅ All 7 required categories present`);
      }
    }

    // Final summary
    console.log(`\n📊 Final Summary:`);
    const totalCategories = await prisma.assetCategory.count();
    console.log(`   Total categories in database: ${totalCategories}`);
    
    // Count by tenant
    for (const tenant of tenants) {
      const count = await prisma.assetCategory.count({
        where: { tenantId: tenant.id },
      });
      console.log(`   ${tenant.name}: ${count} categories`);
    }

    console.log('\n✅ Merge complete!');
  } catch (error) {
    console.error('❌ Merge failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

mergeDuplicates().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

