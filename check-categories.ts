// Unified script to check all AssetCategory field values
// Checks: co2ePerUnit, avgWeight, avgBuybackValue, avgRRP, residualLow, buybackFloor, buybackCap
import prisma from './src/config/database';

// Expected values for all categories
const expectedValues: Record<string, {
  co2ePerUnit: number;
  avgWeight: number;
  avgBuybackValue: number;
  avgRRP: number;
  residualLow: number;
  buybackFloor: number;
  buybackCap: number;
}> = {
  'Networking': {
    co2ePerUnit: 500,
    avgWeight: 1.0,
    avgBuybackValue: 300, // RRP × residualLow = 2000 × 0.15
    avgRRP: 2000,
    residualLow: 0.15,
    buybackFloor: 25,
    buybackCap: 2000,
  },
  'Laptop': {
    co2ePerUnit: 250,
    avgWeight: 2.5,
    avgBuybackValue: 180, // RRP × residualLow = 1000 × 0.18
    avgRRP: 1000,
    residualLow: 0.18,
    buybackFloor: 35,
    buybackCap: 600,
  },
  'Server': {
    co2ePerUnit: 1200,
    avgWeight: 20.0,
    avgBuybackValue: 400, // RRP × residualLow = 5000 × 0.08
    avgRRP: 5000,
    residualLow: 0.08,
    buybackFloor: 60,
    buybackCap: 2500,
  },
  'Smart Phones': {
    co2ePerUnit: 70,
    avgWeight: 0.2,
    avgBuybackValue: 119, // RRP × residualLow = 700 × 0.17
    avgRRP: 700,
    residualLow: 0.17,
    buybackFloor: 30,
    buybackCap: 450,
  },
  'Desktop': {
    co2ePerUnit: 350,
    avgWeight: 8.0,
    avgBuybackValue: 81, // RRP × residualLow = 900 × 0.09
    avgRRP: 900,
    residualLow: 0.09,
    buybackFloor: 15,
    buybackCap: 250,
  },
  'Storage': {
    co2ePerUnit: 800,
    avgWeight: 2.0,
    avgBuybackValue: 300, // RRP × residualLow = 6000 × 0.05
    avgRRP: 6000,
    residualLow: 0.05,
    buybackFloor: 50,
    buybackCap: 3000,
  },
  'Tablets': {
    co2ePerUnit: 90,
    avgWeight: 0.5,
    avgBuybackValue: 102, // RRP × residualLow = 600 × 0.17
    avgRRP: 600,
    residualLow: 0.17,
    buybackFloor: 15,
    buybackCap: 400,
  },
};

async function checkCategories() {
  console.log('🔍 Checking all AssetCategory field values...\n');

  try {
    // Get all categories
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        co2ePerUnit: true,
        avgWeight: true,
        avgBuybackValue: true,
        avgRRP: true,
        residualLow: true,
        buybackFloor: true,
        buybackCap: true,
      },
    });

    console.log('📊 Current Database Values:\n');
    console.log('─'.repeat(120));
    console.log(
      'Category'.padEnd(15) +
      'CO2e'.padEnd(10) +
      'Weight'.padEnd(10) +
      'Buyback'.padEnd(12) +
      'RRP'.padEnd(10) +
      'Residual'.padEnd(12) +
      'Floor'.padEnd(10) +
      'Cap'.padEnd(10) +
      'Status'
    );
    console.log('─'.repeat(120));

    let hasIssues = false;
    let issueCount = 0;

    for (const category of allCategories) {
      const expected = expectedValues[category.name];
      
      if (!expected) {
        console.log(
          category.name.padEnd(15) +
          (category.co2ePerUnit?.toString() ?? 'null').padEnd(10) +
          (category.avgWeight?.toString() ?? 'null').padEnd(10) +
          (category.avgBuybackValue?.toString() ?? 'null').padEnd(12) +
          (category.avgRRP?.toString() ?? 'null').padEnd(10) +
          (category.residualLow?.toString() ?? 'null').padEnd(12) +
          (category.buybackFloor?.toString() ?? 'null').padEnd(10) +
          (category.buybackCap?.toString() ?? 'null').padEnd(10) +
          '⚠️  No expected values'
        );
        continue;
      }

      // Check each field
      const issues: string[] = [];
      
      if (category.co2ePerUnit !== expected.co2ePerUnit) {
        issues.push(`CO2e: ${category.co2ePerUnit} → ${expected.co2ePerUnit}`);
      }
      if (category.avgWeight !== expected.avgWeight) {
        issues.push(`Weight: ${category.avgWeight} → ${expected.avgWeight}`);
      }
      if (Math.abs((category.avgBuybackValue || 0) - expected.avgBuybackValue) > 0.01) {
        issues.push(`Buyback: ${category.avgBuybackValue} → ${expected.avgBuybackValue}`);
      }
      if (category.avgRRP !== expected.avgRRP) {
        issues.push(`RRP: ${category.avgRRP ?? 'null'} → ${expected.avgRRP}`);
      }
      if (category.residualLow !== expected.residualLow) {
        issues.push(`Residual: ${category.residualLow ?? 'null'} → ${expected.residualLow}`);
      }
      if (category.buybackFloor !== expected.buybackFloor) {
        issues.push(`Floor: ${category.buybackFloor ?? 'null'} → ${expected.buybackFloor}`);
      }
      if (category.buybackCap !== expected.buybackCap) {
        issues.push(`Cap: ${category.buybackCap ?? 'null'} → ${expected.buybackCap}`);
      }

      const status = issues.length === 0 ? '✅ OK' : '❌ ISSUES';
      if (issues.length > 0) {
        hasIssues = true;
        issueCount += issues.length;
      }

      console.log(
        category.name.padEnd(15) +
        (category.co2ePerUnit?.toString() ?? 'null').padEnd(10) +
        (category.avgWeight?.toString() ?? 'null').padEnd(10) +
        (category.avgBuybackValue?.toString() ?? 'null').padEnd(12) +
        (category.avgRRP?.toString() ?? 'null').padEnd(10) +
        (category.residualLow?.toString() ?? 'null').padEnd(12) +
        (category.buybackFloor?.toString() ?? 'null').padEnd(10) +
        (category.buybackCap?.toString() ?? 'null').padEnd(10) +
        status
      );

      if (issues.length > 0) {
        issues.forEach(issue => console.log(`  └─ ${issue}`));
      }
    }

    console.log('─'.repeat(120));

    if (hasIssues) {
      console.log(`\n❌ Found ${issueCount} field(s) that need updating!`);
      console.log('💡 Run: npm run db:update-categories');
      process.exit(1);
    } else {
      console.log('\n✅ All category values are correct!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error checking categories:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkCategories().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
