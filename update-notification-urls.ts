// Script to update existing notification URLs from /clients?status=pending to /users?status=pending
import prisma from './src/config/database';

async function updateNotificationUrls() {
  try {
    console.log('Updating notification URLs...');

    // Find all notifications with the old URL pattern
    const notifications = await prisma.notification.findMany({
      where: {
        title: 'New user pending approval',
        url: {
          startsWith: '/clients?status=pending',
        },
      },
    });

    console.log(`Found ${notifications.length} notifications to update`);

    // Update each notification URL
    let updatedCount = 0;
    for (const notification of notifications) {
      const oldUrl = notification.url || '';
      
      // Determine role from relatedType or message if available
      // For client users, relatedType might be 'user' and we need to check the message
      let role = '';
      if (notification.relatedType === 'user' && notification.message) {
        // Extract role from message like "Client John (email) has signed up..."
        if (notification.message.includes('Client ')) {
          role = 'client';
        } else if (notification.message.includes('Reseller ')) {
          role = 'reseller';
        }
      }
      
      // Create new URL - always redirect to /users page
      const newUrl = `/users?status=pending${role ? `&role=${role}` : ''}`;

      await prisma.notification.update({
        where: { id: notification.id },
        data: { url: newUrl },
      });

      updatedCount++;
      console.log(`Updated notification ${notification.id}: ${oldUrl} -> ${newUrl}`);
    }

    console.log(`\n✅ Successfully updated ${updatedCount} notification(s)`);
  } catch (error) {
    console.error('Error updating notification URLs:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateNotificationUrls()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
