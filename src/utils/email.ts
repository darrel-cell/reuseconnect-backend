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
          // EmailJS initialized with public and private keys
        } else {
          // EmailJS initialized with public key only
        }
        
        emailjs.init(initConfig);
      } catch (initError) {
        // Continue - we'll pass publicKey in send() method
      }
    } else {
      // EmailJS configuration missing
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
      // EmailJS not configured, skipping email send
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

      // Send email via EmailJS
      // EmailJS Node.js SDK v5: send(serviceId, templateId, templateParams, options)
      // Options must include publicKey
      
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
      }
      
      const response = await emailjs.send(
        this.emailConfig.serviceId,
        this.emailConfig.templateId,
        templateParams,
        sendOptions
      );

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

