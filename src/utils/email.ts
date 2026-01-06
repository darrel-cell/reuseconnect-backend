// Email Service using EmailJS
import emailjs from '@emailjs/nodejs';
import { config } from '../config/env';

interface SendInviteEmailParams {
  toEmail: string;
  inviteToken: string;
  role: 'client' | 'reseller' | 'driver';
  tenantName: string;
  inviterName: string;
  expiresInDays?: number;
}

interface EmailConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
}

class EmailService {
  private emailConfig: EmailConfig | null = null;

  constructor() {
    // Initialize EmailJS config from environment variables
    if (config.email.enabled && config.email.serviceId && config.email.templateId && config.email.publicKey) {
      this.emailConfig = {
        serviceId: config.email.serviceId,
        templateId: config.email.templateId,
        publicKey: config.email.publicKey,
      };
      // Initialize EmailJS with public key and private key (if available)
      // Private key is required for Node.js/backend applications
      // If private key is not set, you need to enable "API calls for non-browser" in EmailJS dashboard
      try {
        const initConfig: { publicKey: string; privateKey?: string } = {
          publicKey: config.email.publicKey,
        };
        
        // Add private key if available (recommended for Node.js)
        if (config.email.privateKey && config.email.privateKey.trim() !== '') {
          initConfig.privateKey = config.email.privateKey;
          console.log('[Email Service] EmailJS initialized with public and private keys');
        } else {
          console.warn('[Email Service] EmailJS initialized with public key only');
          console.warn('[Email Service] For Node.js/backend, enable "API calls for non-browser" in EmailJS dashboard');
          console.warn('[Email Service] OR add EMAILJS_PRIVATE_KEY to .env for better security');
        }
        
        emailjs.init(initConfig);
        console.log('[Email Service] EmailJS initialized successfully');
      } catch (initError) {
        console.warn('[Email Service] EmailJS init warning:', initError);
        // Continue - we'll pass publicKey in send() method
      }
      console.log('[Email Service] Config:', {
        serviceId: config.email.serviceId.substring(0, 15) + '...',
        templateId: config.email.templateId.substring(0, 15) + '...',
        publicKey: config.email.publicKey.substring(0, 10) + '...',
        publicKeyFullLength: config.email.publicKey.length,
        publicKeyIsEmpty: config.email.publicKey.trim() === '',
      });
    } else {
      console.warn('[Email Service] EmailJS configuration missing. Email sending will be disabled.');
      console.warn('[Email Service] Current config:', {
        enabled: config.email.enabled,
        hasServiceId: !!config.email.serviceId,
        hasTemplateId: !!config.email.templateId,
        hasPublicKey: !!config.email.publicKey,
      });
      console.warn('[Email Service] Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, and EMAILJS_PUBLIC_KEY in .env');
    }
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.emailConfig !== null && config.email.enabled;
  }

  /**
   * Send invitation email
   */
  async sendInviteEmail(params: SendInviteEmailParams): Promise<void> {
    if (!this.emailConfig) {
      console.warn('[Email Service] EmailJS not configured. Skipping email send.');
      console.warn('[Email Service] Config check:', {
        enabled: config.email.enabled,
        hasServiceId: !!config.email.serviceId,
        hasTemplateId: !!config.email.templateId,
        hasPublicKey: !!config.email.publicKey,
      });
      return;
    }

    try {
      const {
        toEmail,
        inviteToken,
        role,
        tenantName,
        inviterName,
        expiresInDays = 14,
      } = params;

      console.log('[Email Service] Attempting to send invitation email:', {
        to: toEmail,
        role,
        tenantName,
        inviterName,
      });

      // Build invitation URL
      const inviteUrl = `${config.email.frontendUrl}/invite?token=${inviteToken}`;

      // Determine role display name
      const roleDisplayName = {
        client: 'Client',
        reseller: 'Reseller',
        driver: 'Driver',
      }[role] || role;

      // Prepare template parameters
      // These variable names should match your EmailJS template variables
      const templateParams = {
        to_email: toEmail,
        to_name: toEmail.split('@')[0], // Use email prefix as name if name not available
        inviter_name: inviterName,
        tenant_name: tenantName,
        role: roleDisplayName,
        invite_url: inviteUrl,
        expires_in_days: expiresInDays.toString(),
        // Additional fields that might be useful in email template
        support_email: config.email.supportEmail,
        app_name: tenantName,
      };

      console.log('[Email Service] Sending email with params:', {
        serviceId: this.emailConfig.serviceId,
        templateId: this.emailConfig.templateId,
        templateParams: {
          ...templateParams,
          invite_url: inviteUrl.substring(0, 50) + '...', // Log partial URL for security
        },
      });

      // Send email via EmailJS
      // EmailJS Node.js SDK v5: send(serviceId, templateId, templateParams, options)
      // Options must include publicKey
      console.log('[Email Service] Calling emailjs.send with:', {
        serviceId: this.emailConfig.serviceId,
        templateId: this.emailConfig.templateId,
        hasPublicKey: !!this.emailConfig.publicKey,
        publicKeyPreview: this.emailConfig.publicKey ? this.emailConfig.publicKey.substring(0, 10) + '...' : 'MISSING',
        publicKeyLength: this.emailConfig.publicKey ? this.emailConfig.publicKey.length : 0,
      });
      
      // Verify publicKey is not empty
      if (!this.emailConfig.publicKey || this.emailConfig.publicKey.trim() === '') {
        throw new Error('EmailJS publicKey is empty or not set');
      }
      
      // Pass publicKey (and privateKey if available) in options object
      // Private key is required for Node.js/backend unless "API calls for non-browser" is enabled
      const sendOptions: { publicKey: string; privateKey?: string } = {
        publicKey: this.emailConfig.publicKey.trim(),
      };
      
      // Add private key if available (recommended for Node.js)
      if (config.email.privateKey && config.email.privateKey.trim() !== '') {
        sendOptions.privateKey = config.email.privateKey.trim();
        console.log('[Email Service] Using private key for authentication');
        console.log('[Email Service] Private key preview:', config.email.privateKey.substring(0, 10) + '...');
      } else {
        console.warn('[Email Service] No private key set - ensure "API calls for non-browser" is enabled in EmailJS dashboard');
      }
      
      const response = await emailjs.send(
        this.emailConfig.serviceId,
        this.emailConfig.templateId,
        templateParams,
        sendOptions
      );

      console.log('[Email Service] Invitation email sent successfully:', {
        to: toEmail,
        status: response.status,
        text: response.text,
      });
    } catch (error) {
      console.error('[Email Service] Failed to send invitation email:', error);
      console.error('[Email Service] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });
      // Don't throw error - invitation is still created in database
      // Log error for monitoring but allow invitation creation to succeed
      // Re-throw to let the caller handle it (they'll catch and log)
      throw error;
    }
  }

  /**
   * Send test email (for testing EmailJS configuration)
   */
  async sendTestEmail(toEmail: string): Promise<void> {
    if (!this.emailConfig) {
      throw new Error('EmailJS not configured');
    }

    try {
      const templateParams = {
        to_email: toEmail,
        to_name: toEmail.split('@')[0],
        message: 'This is a test email from ITAD Platform',
        app_name: config.email.frontendUrl.includes('localhost') ? 'ITAD Platform (Dev)' : 'ITAD Platform',
      };

      // Pass publicKey (and privateKey if available) in options for test email
      const sendOptions: { publicKey: string; privateKey?: string } = {
        publicKey: this.emailConfig.publicKey.trim(),
      };
      
      if (config.email.privateKey && config.email.privateKey.trim() !== '') {
        sendOptions.privateKey = config.email.privateKey.trim();
      }
      
      const response = await emailjs.send(
        this.emailConfig.serviceId,
        this.emailConfig.templateId,
        templateParams,
        sendOptions
      );

      console.log('[Email Service] Test email sent:', response);
    } catch (error) {
      console.error('[Email Service] Failed to send test email:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();

