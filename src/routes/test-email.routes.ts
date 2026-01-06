// Test email route (for debugging EmailJS)
// Remove this in production or protect with admin-only access

import { Router } from 'express';
import { emailService } from '../utils/email';
import { config } from '../config/env';

const router = Router();

// Test email configuration
router.get('/config', (req, res) => {
  res.json({
    configured: emailService.isConfigured(),
    config: {
      enabled: config.email.enabled,
      hasServiceId: !!config.email.serviceId,
      hasTemplateId: !!config.email.templateId,
      hasPublicKey: !!config.email.publicKey,
      serviceId: config.email.serviceId ? `${config.email.serviceId.substring(0, 10)}...` : 'NOT SET',
      templateId: config.email.templateId ? `${config.email.templateId.substring(0, 10)}...` : 'NOT SET',
      publicKey: config.email.publicKey ? `${config.email.publicKey.substring(0, 10)}...` : 'NOT SET',
      frontendUrl: config.email.frontendUrl,
    },
  });
});

// Send test email
router.post('/test', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email address is required',
      });
    }

    if (!emailService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: 'EmailJS is not configured. Check your .env file.',
      });
    }

    await emailService.sendTestEmail(email);
    
    res.json({
      success: true,
      message: `Test email sent to ${email}`,
    });
  } catch (error) {
    console.error('[Test Email Route] Error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

export default router;

