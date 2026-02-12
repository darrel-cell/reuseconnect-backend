// Two-Factor Authentication Service
import prisma from '../config/database';
import { emailService } from '../utils/email';
import { config } from '../config/env';

export class TwoFactorService {
  /**
   * Generate a 6-digit verification code
   */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send 2FA verification code to admin's email
   */
  async sendVerificationCode(userId: string, email: string, userName: string, tenantName: string): Promise<string> {
    // Generate 6-digit code
    const code = this.generateCode();

    // Set expiration to 10 minutes from now
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalidate any existing unused codes for this user
    await prisma.twoFactorCode.updateMany({
      where: {
        userId,
        used: false,
      },
      data: {
        used: true, // Mark as used to invalidate
      },
    });

    // Create new verification code
    await prisma.twoFactorCode.create({
      data: {
        userId,
        code,
        email,
        expiresAt,
      },
    });

    // Send email with verification code
    try {
      if (emailService.isConfigured()) {
        // Check if 2FA template ID is configured
        if (config.email.templateIdTwoFactor) {
          await emailService.sendTwoFactorCode({
            toEmail: email,
            userName,
            code,
            tenantName,
          });
        } else {
          // Fallback: log warning if template not configured
          const { logger } = await import('../utils/logger');
          logger.warn('2FA email template not configured. Code generated but email not sent.', {
            userId,
            email,
            code, // Log code for development (remove in production)
          });
        }
      }
    } catch (error) {
      // Log error but don't fail code generation
      const { logger } = await import('../utils/logger');
      logger.error('Failed to send 2FA verification code email', {
        userId,
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Still return the code - it's stored in database
    }

    return code;
  }

  /**
   * Resend 2FA verification code with rate limiting
   * Only allows resend if last code was sent more than 30 seconds ago
   */
  async resendVerificationCode(userId: string, email: string, userName: string, tenantName: string): Promise<{ code: string; canResend: boolean; message?: string }> {
    // Check if there's a recent unused code (within last 30 seconds)
    const thirtySecondsAgo = new Date();
    thirtySecondsAgo.setSeconds(thirtySecondsAgo.getSeconds() - 30);

    const recentCode = await prisma.twoFactorCode.findFirst({
      where: {
        userId,
        used: false,
        createdAt: {
          gte: thirtySecondsAgo,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (recentCode) {
      // Calculate remaining seconds
      const secondsSinceLastCode = Math.floor((new Date().getTime() - recentCode.createdAt.getTime()) / 1000);
      const remainingSeconds = 30 - secondsSinceLastCode;
      
      return {
        code: '',
        canResend: false,
        message: `Please wait ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} before requesting a new code.`,
      };
    }

    // Rate limit passed - send new code
    const code = await this.sendVerificationCode(userId, email, userName, tenantName);
    
    return {
      code,
      canResend: true,
    };
  }

  /**
   * Verify 2FA code
   */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    // Find the most recent unused code for this user
    const twoFactorCode = await prisma.twoFactorCode.findFirst({
      where: {
        userId,
        code,
        used: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!twoFactorCode) {
      return false;
    }

    // Mark code as used
    await prisma.twoFactorCode.update({
      where: { id: twoFactorCode.id },
      data: { used: true },
    });

    return true;
  }

  /**
   * Clean up expired codes (can be called periodically)
   */
  async cleanupExpiredCodes(): Promise<number> {
    const result = await prisma.twoFactorCode.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }
}
