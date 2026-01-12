// Script to populate database with current hardcoded buyback values
// This populates the new fields (avgRRP, residualLow, buybackFloor, buybackCap) with existing hardcoded values
import prisma from './src/config/database';

// Current hardcoded values (from backend/src/utils/co2.ts and frontend/src/lib/calculations.ts)
const categoryValues: Record<string, { avgRRP: number; residualLow: number; floor: number; cap: number }> = {
  'Networking': { avgRRP: 2000, residualLow: 0.15, floor: 30, cap: 2000 },
  'Laptop': { avgRRP: 1000, residualLow: 0.18, floor: 30, cap: 600 },
  'Server': { avgRRP: 5000, residualLow: 0.08, floor: 50, cap: 2500 },
  'Smart Phones': { avgRRP: 700, residualLow: 0.17, floor: 10, cap: 450 },
  'Smartphone': { avgRRP: 700, residualLow: 0.17, floor: 10, cap: 450 },
  'Smartphones': { avgRRP: 700, residualLow: 0.17, floor: 10, cap: 450 },
  'Desktop': { avgRRP: 900, residualLow: 0.09, floor: 10, cap: 250 },
  'Storage': { avgRRP: 6000, residualLow: 0.05, floor: 50, cap: 3000 },
  'Tablets': { avgRRP: 600, residualLow: 0.17, floor: 15, cap: 400 },
  'Tablet': { avgRRP: 600, residualLow: 0.17, floor: 15, cap: 400 },
};

async function populateBuybackValues() {
  console.log('🔄 Populating buyback calculation values in database...\n');

  try {
    // Get all categories
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });

    console.log('📊 Updating categories:\n');

    let updatedCount = 0;

    for (const category of allCategories) {
      const values = categoryValues[category.name];
      
      if (values) {
        // Calculate expected avgBuybackValue (base value without volume factor)
        const expectedAvgBuybackValue = values.avgRRP * values.residualLow;
        
        const updates: string[] = [];
        
        // Update fields if they're null or different
        const updatesNeeded: any = {};
        
        if (category.avgRRP !== values.avgRRP) {
          updatesNeeded.avgRRP = values.avgRRP;
          updates.push(`avgRRP: ${category.avgRRP ?? 'null'} → ${values.avgRRP}`);
        }
        
        if (category.residualLow !== values.residualLow) {
          updatesNeeded.residualLow = values.residualLow;
          updates.push(`residualLow: ${category.residualLow ?? 'null'} → ${values.residualLow}`);
        }
        
        if (category.buybackFloor !== values.floor) {
          updatesNeeded.buybackFloor = values.floor;
          updates.push(`buybackFloor: ${category.buybackFloor ?? 'null'} → ${values.floor}`);
        }
        
        if (category.buybackCap !== values.cap) {
          updatesNeeded.buybackCap = values.cap;
          updates.push(`buybackCap: ${category.buybackCap ?? 'null'} → ${values.cap}`);
        }
        
        // Also update avgBuybackValue if it doesn't match (base value)
        if (Math.abs((category.avgBuybackValue || 0) - expectedAvgBuybackValue) > 0.01) {
          updatesNeeded.avgBuybackValue = expectedAvgBuybackValue;
          updates.push(`avgBuybackValue: ${category.avgBuybackValue} → ${expectedAvgBuybackValue.toFixed(2)}`);
        }
        
        if (Object.keys(updatesNeeded).length > 0) {
          await prisma.assetCategory.update({
            where: { id: category.id },
            data: updatesNeeded,
          });
          console.log(`   ✅ ${category.name}: ${updates.join(', ')}`);
          updatedCount++;
        } else {
          console.log(`   ✓  ${category.name}: Already up to date`);
        }
      } else {
        console.log(`   ⚠️  ${category.name}: No values defined (skipping)`);
      }
    }

    // Ensure BuybackConfig exists
    const config = await prisma.buybackConfig.findUnique({
      where: { id: 'singleton' },
    });

    if (!config) {
      await prisma.buybackConfig.create({
        data: {
          id: 'singleton',
          volumeFactor10: 1.03,
          volumeFactor50: 1.06,
          volumeFactor200: 1.10,
          ageFactor: 1.0,
          conditionFactor: 1.0,
          marketFactor: 1.0,
        },
      });
      console.log('\n   ✅ Created BuybackConfig with default values');
    } else {
      console.log('\n   ✓  BuybackConfig already exists');
    }

    console.log(`\n✅ Update complete! Updated ${updatedCount} categories.`);
  } catch (error) {
    console.error('❌ Error populating values:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

populateBuybackValues().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
