// Script to check for duplicate categories and remove them, keeping only 7 unique ones
import prisma from './src/config/database';

async function checkAndClean() {
  console.log('🔍 Checking for duplicate asset categories...\n');

  try {
    // Get all categories across all tenants
    const allCategories = await prisma.assetCategory.findMany({
      orderBy: [
        { tenantId: 'asc' },
        { name: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    console.log(`📊 Total categories in database: ${allCategories.length}`);

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

    // Group by tenant and name
    const byTenant = new Map<string, Map<string, typeof allCategories>>();

    for (const category of allCategories) {
      if (!byTenant.has(category.tenantId)) {
        byTenant.set(category.tenantId, new Map());
      }
      const tenantMap = byTenant.get(category.tenantId)!;
      
      if (!tenantMap.has(category.name)) {
        tenantMap.set(category.name, []);
      }
      tenantMap.get(category.name)!.push(category);
    }

    let totalToDelete = 0;
    const deleteIds: string[] = [];

    // Process each tenant
    for (const [tenantId, categoriesByName] of byTenant.entries()) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const tenantName = tenant?.name || tenantId;
      
      console.log(`\n📦 Tenant: ${tenantName}`);
      console.log(`   Total category names: ${categoriesByName.size}`);

      for (const [categoryName, duplicates] of categoriesByName.entries()) {
        if (requiredCategories.includes(categoryName)) {
          // Required category - keep the oldest, delete the rest
          if (duplicates.length > 1) {
            const toKeep = duplicates[0]; // Oldest
            const toDelete = duplicates.slice(1);
            
            console.log(`   ⚠️  "${categoryName}": ${duplicates.length} found - keeping oldest (${toKeep.id}), deleting ${toDelete.length} duplicates`);
            
            for (const dup of toDelete) {
              deleteIds.push(dup.id);
              totalToDelete++;
            }
          } else {
            console.log(`   ✅ "${categoryName}": Unique`);
          }
        } else {
          // Not a required category - delete all
          console.log(`   🗑️  "${categoryName}": ${duplicates.length} found - NOT in required list, deleting all`);
          
          for (const cat of duplicates) {
            deleteIds.push(cat.id);
            totalToDelete++;
          }
        }
      }
    }

    // Delete duplicates
    if (deleteIds.length > 0) {
      console.log(`\n🗑️  Deleting ${deleteIds.length} duplicate/unwanted categories...`);
      
      // Delete in batches to avoid issues
      const batchSize = 100;
      for (let i = 0; i < deleteIds.length; i += batchSize) {
        const batch = deleteIds.slice(i, i + batchSize);
        await prisma.assetCategory.deleteMany({
          where: { id: { in: batch } },
        });
        console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`);
      }
      
      console.log(`✅ Deleted ${deleteIds.length} categories`);
    } else {
      console.log(`\n✅ No duplicates found - all categories are unique`);
    }

    // Verify final state
    console.log(`\n📋 Final verification:`);
    const finalCategories = await prisma.assetCategory.findMany({
      orderBy: [
        { tenantId: 'asc' },
        { name: 'asc' },
      ],
    });

    console.log(`   Total categories remaining: ${finalCategories.length}`);

    // Group by tenant for summary
    const finalByTenant = new Map<string, typeof finalCategories>();
    for (const cat of finalCategories) {
      if (!finalByTenant.has(cat.tenantId)) {
        finalByTenant.set(cat.tenantId, []);
      }
      finalByTenant.get(cat.tenantId)!.push(cat);
    }

    for (const [tenantId, cats] of finalByTenant.entries()) {
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      const tenantName = tenant?.name || tenantId;
      const uniqueNames = new Set(cats.map(c => c.name));
      
      console.log(`\n   ${tenantName}:`);
      console.log(`      Categories: ${cats.length} (${uniqueNames.size} unique names)`);
      
      if (cats.length === 7 && uniqueNames.size === 7) {
        console.log(`      ✅ Perfect! All 7 required categories present`);
        cats.forEach(c => console.log(`         - ${c.name}`));
      } else {
        console.log(`      ⚠️  Expected 7 categories, found ${cats.length}`);
        const missing = requiredCategories.filter(name => !uniqueNames.has(name));
        if (missing.length > 0) {
          console.log(`      Missing: ${missing.join(', ')}`);
        }
      }
    }

    console.log('\n✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkAndClean().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

