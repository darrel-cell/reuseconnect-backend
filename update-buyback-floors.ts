// Script to update buybackFloor values in database
// Simple buyback estimate: buybackFloor × quantity

import prisma from './src/config/database';

async function updateBuybackFloors() {
  console.log('🔄 Updating buybackFloor values in database...\n');

  try {
    // Category floor prices (per unit) for buyback estimates
    const categoryFloors: Record<string, number> = {
      'Laptop': 35,
      'Desktop': 15,
      'Server': 60,
      'Tablets': 15,
      'Smart Phones': 30,
      'Networking': 25,
      'Storage': 35,
    };

    // Get all categories
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });

    console.log('📊 Updating buybackFloor values:\n');

    let updatedCount = 0;

    for (const category of allCategories) {
      const floorPrice = categoryFloors[category.name];
      
      if (floorPrice !== undefined) {
        if (category.buybackFloor !== floorPrice) {
          await prisma.assetCategory.update({
            where: { id: category.id },
            data: { buybackFloor: floorPrice },
          });
          console.log(`   ✅ ${category.name}: buybackFloor ${category.buybackFloor ?? 'null'} → £${floorPrice}`);
          updatedCount++;
        } else {
          console.log(`   ✓  ${category.name}: Already set to £${floorPrice}`);
        }
      } else {
        console.log(`   ⚠️  ${category.name}: No floor price defined (skipping)`);
      }
    }

    console.log(`\n✅ Update complete! Updated ${updatedCount} categories.`);
    
    // Display all categories with their current buybackFloor values
    console.log('\n📊 Current buybackFloor values by category:');
    const updatedCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });
    for (const cat of updatedCategories) {
      console.log(`   ${cat.name}: £${cat.buybackFloor ?? 'null'}`);
    }
  } catch (error) {
    console.error('❌ Error updating buyback floors:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateBuybackFloors().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
