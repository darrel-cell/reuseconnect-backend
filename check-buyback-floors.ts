// Script to check current buybackFloor values in database
// Use this to verify if buybackFloor values are set correctly
import prisma from './src/config/database';

async function checkBuybackFloors() {
  console.log('🔍 Checking buybackFloor values in database...\n');

  try {
    // Get all categories
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        buybackFloor: true,
        avgRRP: true,
        residualLow: true,
        buybackCap: true,
      },
    });

    console.log('📊 Current buybackFloor Values:\n');
    console.log('─'.repeat(100));
    console.log(
      'Category'.padEnd(20) +
      'buybackFloor'.padEnd(20) +
      'avgRRP'.padEnd(15) +
      'residualLow'.padEnd(15) +
      'buybackCap'.padEnd(15) +
      'Status'
    );
    console.log('─'.repeat(100));

    let hasIssues = false;
    let nullCount = 0;

    for (const category of allCategories) {
      const isNull = category.buybackFloor === null || category.buybackFloor === undefined;
      let status = '✅ OK';
      
      if (isNull) {
        status = '❌ NULL';
        hasIssues = true;
        nullCount++;
      }

      console.log(
        category.name.padEnd(20) +
        (category.buybackFloor?.toString() ?? 'null').padEnd(20) +
        (category.avgRRP?.toString() ?? 'null').padEnd(15) +
        (category.residualLow?.toString() ?? 'null').padEnd(15) +
        (category.buybackCap?.toString() ?? 'null').padEnd(15) +
        status
      );
    }

    console.log('─'.repeat(100));

    if (hasIssues) {
      console.log(`\n❌ Found ${nullCount} category/categories with NULL buybackFloor values!`);
      console.log('💡 This will cause buyback calculations to return 0.');
      console.log('\n🔧 To fix, run one of these scripts:');
      console.log('   npm run db:update-buyback-floors  (updates only buybackFloor)');
      console.log('   npm run db:populate-buyback       (updates all buyback fields)');
      process.exit(1);
    } else {
      console.log('\n✅ All categories have buybackFloor values set!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Error checking buyback floors:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkBuybackFloors().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
