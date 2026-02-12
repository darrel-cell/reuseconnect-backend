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

interface SendInvitationAcceptedEmailParams {
  toEmail: string;
  inviterName: string;
  acceptedUserName: string;
  acceptedUserEmail: string;
  acceptedUserRole: 'client' | 'reseller' | 'driver';
  tenantName: string;
}

interface SendBookingCreatedEmailParams {
  toEmail: string;
  bookingNumber: string;
  clientName: string;
  siteName: string;
  scheduledDate: string;
  tenantName: string;
}

interface SendTwoFactorCodeParams {
  toEmail: string;
  userName: string;
  code: string;
  tenantName: string;
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
    // At minimum, need serviceId, default templateId, and publicKey
    if (config.email.enabled && config.email.serviceId && config.email.templateId && config.email.publicKey) {
      this.emailConfig = {
        serviceId: config.email.serviceId,
        templateId: config.email.templateId, // Default template (used for invitation emails)
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
      
      await emailjs.send(
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
   * Send invitation accepted notification email
   * Simple notification to inviter that their invitation was accepted
   */
  async sendInvitationAcceptedEmail(params: SendInvitationAcceptedEmailParams): Promise<void> {
    if (!this.emailConfig) {
      // EmailJS not configured, skipping email send
      return;
    }

    // Check if specific template ID is configured
    if (!config.email.templateIdInviteAccepted) {
      // Template ID not set, skipping email send
      return;
    }

    try {
      const {
        toEmail,
        inviterName,
        acceptedUserName,
        acceptedUserEmail,
        acceptedUserRole,
        tenantName,
      } = params;

      // Determine role display name
      const roleDisplayName = {
        client: 'Client',
        reseller: 'Reseller',
        driver: 'Driver',
      }[acceptedUserRole] || acceptedUserRole;

      // Build dashboard URL
      const dashboardUrl = `${config.email.frontendUrl}/users`;

      // Prepare template parameters - simple and clear
      const templateParams = {
        to_email: toEmail,
        to_name: inviterName,
        message: `${acceptedUserName} has accepted your invitation to join as a ${roleDisplayName}.`,
        subject: `Invitation Accepted - ${acceptedUserName}`,
        accepted_user_name: acceptedUserName,
        accepted_user_email: acceptedUserEmail,
        accepted_user_role: roleDisplayName,
        dashboard_url: dashboardUrl,
        app_name: tenantName,
      };

      // Pass publicKey (and privateKey if available) in options
      const sendOptions: { publicKey: string; privateKey?: string } = {
        publicKey: this.emailConfig.publicKey.trim(),
      };
      
      if (config.email.privateKey && config.email.privateKey.trim() !== '') {
        sendOptions.privateKey = config.email.privateKey.trim();
      }
      
      await emailjs.send(
        this.emailConfig.serviceId,
        config.email.templateIdInviteAccepted,
        templateParams,
        sendOptions
      );

    } catch (error) {
      console.error('[Email Service] Failed to send invitation accepted email:', error);
      console.error('[Email Service] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });
      // Don't throw error - invitation acceptance should still succeed
    }
  }

  /**
   * Send booking created notification email to admin team
   * Simple notification with essential booking information
   */
  async sendBookingCreatedEmail(params: SendBookingCreatedEmailParams): Promise<void> {
    if (!this.emailConfig) {
      // EmailJS not configured, skipping email send
      return;
    }

    // Check if specific template ID is configured
    if (!config.email.templateIdBookingCreated) {
      // Template ID not set, skipping email send
      console.warn('[Email Service] Booking created email template ID not configured. Set EMAILJS_TEMPLATE_ID_BOOKING_CREATED environment variable.');
      return;
    }

    try {
      const {
        toEmail,
        bookingNumber,
        clientName,
        siteName,
        scheduledDate,
        tenantName,
      } = params;

      // Validate recipient email
      if (!toEmail || !toEmail.trim()) {
        console.error('[Email Service] Recipient email is empty for booking created email', {
          bookingNumber,
          toEmail,
        });
        throw new Error('Recipient email address is required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(toEmail.trim())) {
        console.error('[Email Service] Invalid recipient email format for booking created email', {
          bookingNumber,
          toEmail,
        });
        throw new Error('Invalid recipient email format');
      }

      // Format scheduled date - date only, no time
      const formattedDate = new Date(scheduledDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

      // Build booking URL
      const bookingUrl = `${config.email.frontendUrl}/bookings`;

      // Prepare template parameters - simple and clear
      // CRITICAL: In EmailJS template settings, you MUST set "To Email" field to: {{to_email}}
      // Without this, EmailJS will return "The recipients address is empty" error
      const templateParams = {
        to_email: toEmail.trim(),
        reply_to: toEmail.trim(), // Also set reply_to in case it helps
        message: `New booking ${bookingNumber} has been created and requires your approval.`,
        subject: `New Booking - ${bookingNumber}`,
        booking_number: bookingNumber,
        client_name: clientName,
        site_name: siteName,
        scheduled_date: formattedDate,
        booking_url: bookingUrl,
        app_name: tenantName,
      };

      // Pass publicKey (and privateKey if available) in options
      const sendOptions: { publicKey: string; privateKey?: string } = {
        publicKey: this.emailConfig.publicKey.trim(),
      };
      
      if (config.email.privateKey && config.email.privateKey.trim() !== '') {
        sendOptions.privateKey = config.email.privateKey.trim();
      }
      
      // templateIdBookingCreated is checked above, so it's safe to use here
      // IMPORTANT: In EmailJS template settings, set "To Email" field to: {{to_email}}
      await emailjs.send(
        this.emailConfig.serviceId,
        config.email.templateIdBookingCreated!,
        templateParams,
        sendOptions
      );

    } catch (error: any) {
      console.error('[Email Service] Failed to send booking created email:', error);
      
      // Check if it's the "recipients address is empty" error
      const isRecipientEmptyError = error?.text?.includes('recipients address is empty') || 
                                    error?.text?.includes('recipient') ||
                                    error?.status === 422;
      
      if (isRecipientEmptyError) {
        console.error('[Email Service] EmailJS template configuration issue: "To Email" field must be set to {{to_email}} in template ' + config.email.templateIdBookingCreated);
      }
      
      console.error('[Email Service] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        status: error?.status,
        text: error?.text,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        toEmail: params.toEmail?.trim(),
        bookingNumber: params.bookingNumber,
        templateId: config.email.templateIdBookingCreated,
      });
      // Don't throw error - booking creation should still succeed
    }
  }

  /**
   * Send 2FA verification code email
   */
  async sendTwoFactorCode(params: SendTwoFactorCodeParams): Promise<void> {
    if (!this.emailConfig) {
      // EmailJS not configured, skipping email send
      return;
    }

    // Check if specific template ID is configured
    if (!config.email.templateIdTwoFactor) {
      // Template ID not set, skipping email send
      return;
    }

    try {
      const {
        toEmail,
        userName,
        code,
        tenantName,
      } = params;

      // Build dashboard URL
      const dashboardUrl = `${config.email.frontendUrl}/dashboard`;

      // Prepare template parameters
      const templateParams = {
        to_email: toEmail,
        to_name: userName,
        verification_code: code,
        dashboard_url: dashboardUrl,
        app_name: tenantName,
      };

      // Pass publicKey (and privateKey if available) in options
      const sendOptions: { publicKey: string; privateKey?: string } = {
        publicKey: this.emailConfig.publicKey.trim(),
      };
      
      if (config.email.privateKey && config.email.privateKey.trim() !== '') {
        sendOptions.privateKey = config.email.privateKey.trim();
      }
      
      await emailjs.send(
        this.emailConfig.serviceId,
        config.email.templateIdTwoFactor,
        templateParams,
        sendOptions
      );

    } catch (error) {
      console.error('[Email Service] Failed to send 2FA verification code email:', error);
      console.error('[Email Service] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });
      // Don't throw error - code is still generated and stored
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

