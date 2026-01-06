// Script to sync booking and job statuses
import { syncAllStatuses } from './src/utils/sync-statuses';

async function main() {
  try {
    console.log('Starting status synchronization...');
    const result = await syncAllStatuses();
    console.log(`\nSync completed successfully!`);
    console.log(`Synced: ${result.syncedCount} records`);
    console.log(`Skipped: ${result.skippedCount} records`);
    process.exit(0);
  } catch (error) {
    console.error('Error syncing statuses:', error);
    process.exit(1);
  }
}

main();

