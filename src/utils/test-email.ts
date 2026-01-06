// Test script for EmailJS configuration
// Run with: npx tsx src/utils/test-email.ts

import { emailService } from './email';
import { config } from '../config/env';

async function testEmail() {
  console.log('=== EmailJS Configuration Test ===\n');
  
  // Check configuration
  console.log('Configuration Status:');
  console.log('- EMAILJS_ENABLED:', config.email.enabled);
  console.log('- EMAILJS_SERVICE_ID:', config.email.serviceId ? `${config.email.serviceId.substring(0, 10)}...` : 'NOT SET');
  console.log('- EMAILJS_TEMPLATE_ID:', config.email.templateId ? `${config.email.templateId.substring(0, 10)}...` : 'NOT SET');
  console.log('- EMAILJS_PUBLIC_KEY:', config.email.publicKey ? `${config.email.publicKey.substring(0, 10)}...` : 'NOT SET');
  console.log('- FRONTEND_URL:', config.email.frontendUrl);
  console.log('- SUPPORT_EMAIL:', config.email.supportEmail);
  console.log('\n');

  // Check if configured
  const isConfigured = emailService.isConfigured();
  console.log('Email Service Configured:', isConfigured);
  console.log('\n');

  if (!isConfigured) {
    console.error('❌ EmailJS is not properly configured!');
    console.error('Please check your .env file and ensure all EmailJS variables are set.');
    process.exit(1);
  }

  // Test email sending
  const testEmail = process.argv[2] || 'test@example.com';
  console.log(`Attempting to send test email to: ${testEmail}\n`);

  try {
    await emailService.sendTestEmail(testEmail);
    console.log('\n✅ Test email sent successfully!');
    console.log('Check the recipient inbox for the test email.');
  } catch (error) {
    console.error('\n❌ Failed to send test email:');
    console.error(error);
    if (error instanceof Error) {
      console.error('\nError details:');
      console.error('- Message:', error.message);
      console.error('- Stack:', error.stack);
    }
    process.exit(1);
  }
}

testEmail().catch(console.error);

