// Quick script to activate a user for testing
import prisma from './src/config/database';

async function activateUser() {
  const email = 'test@example.com';
  
  const user = await prisma.user.update({
    where: { email },
    data: { status: 'active' },
  });
  
  console.log(`User ${email} activated!`);
  console.log(`Status: ${user.status}`);
  
  await prisma.$disconnect();
}

activateUser().catch(console.error);

