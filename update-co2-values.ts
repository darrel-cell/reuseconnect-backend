// Script to update CO2e values and avgBuybackValue in asset categories
// Based on provided specifications:
// 
// CO2e Updates (Average CO₂e per unit - cradle → 3 years use):
// - Networking equipment: 500 kg CO2e (was 100)
// - Laptop: 250 kg CO2e (already correct)
// - Server: 1,200 kg CO2e (already correct)
// - Smartphone: 70 kg CO2e (already correct)
// - Desktop (incl. monitor): 350 kg CO2e (was 300)
// - Storage (SAN / NAS): 800 kg CO2e (was 200)
// - Tablet: 90 kg CO2e (was 80)
//
// avgBuybackValue Updates (conservative low-end base values):
// RRP × residual_low % for quantity 1 (no volume factor)
// - Networking: £2,000 × 15% = £300
// - Laptop: £1,000 × 18% = £180
// - Server: £5,000 × 8% = £400
// - Smartphone: £700 × 17% = £119
// - Desktop: £900 × 9% = £81
// - Storage: £6,000 × 5% = £300
// - Tablet: £600 × 17% = £102
import prisma from './src/config/database';

async function updateCO2Values() {
  console.log('🔄 Updating CO2e values and avgBuybackValue in asset categories...\n');

  try {
    // Category updates mapping
    const categoryUpdates: Record<string, { co2ePerUnit: number; avgBuybackValue: number }> = {
      'Networking': { co2ePerUnit: 500, avgBuybackValue: 300 },
      'Laptop': { co2ePerUnit: 250, avgBuybackValue: 180 },
      'Server': { co2ePerUnit: 1200, avgBuybackValue: 400 },
      'Smart Phones': { co2ePerUnit: 70, avgBuybackValue: 119 },
      'Desktop': { co2ePerUnit: 350, avgBuybackValue: 81 },
      'Storage': { co2ePerUnit: 800, avgBuybackValue: 300 },
      'Tablets': { co2ePerUnit: 90, avgBuybackValue: 102 },
    };

    // Get all categories
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
    });

    console.log('📊 Updating categories:\n');

    // Update each category
    for (const category of allCategories) {
      const update = categoryUpdates[category.name];
      if (update) {
        const changes: string[] = [];
        
        if (category.co2ePerUnit !== update.co2ePerUnit) {
          changes.push(`CO2e: ${category.co2ePerUnit} → ${update.co2ePerUnit} kg`);
        }
        
        if (category.avgBuybackValue !== update.avgBuybackValue) {
          changes.push(`Buyback: £${category.avgBuybackValue} → £${update.avgBuybackValue}`);
        }

        if (changes.length > 0) {
          await prisma.assetCategory.update({
            where: { id: category.id },
            data: {
              co2ePerUnit: update.co2ePerUnit,
              avgBuybackValue: update.avgBuybackValue,
            },
          });
          console.log(`   ✅ ${category.name}: ${changes.join(', ')}`);
        } else {
          console.log(`   ✓  ${category.name}: Already up to date`);
        }
      } else {
        console.log(`   ⚠️  ${category.name}: No update configuration found`);
      }
    }

    // Display all categories with their current values
    console.log('\n📊 Current values by category:');
    const updatedCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      select: {
        name: true,
        co2ePerUnit: true,
        avgBuybackValue: true,
      },
    });
    for (const cat of updatedCategories) {
      console.log(`   ${cat.name}: ${cat.co2ePerUnit} kg CO2e, £${cat.avgBuybackValue} buyback`);
    }

    console.log('\n✅ Update complete!');
  } catch (error) {
    console.error('❌ Error updating values:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

updateCO2Values().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
