/**
 * Utility functions for sanitizing PII (Personally Identifiable Information) in logs
 * Helps comply with GDPR and other privacy regulations
 */

/**
 * Masks an email address for logging
 * Example: "john.doe@example.com" -> "jo***@example.com"
 * @param email The email address to mask
 * @returns Masked email address
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) {
    return '[REDACTED]';
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return '[REDACTED]';
  }

  const [localPart, domain] = parts;
  
  // Show first 2 characters of local part, mask the rest
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  
  return `${localPart.substring(0, 2)}***@${domain}`;
}

/**
 * Masks a user ID for logging
 * Example: "abc12345-6789-0123-4567-890123456789" -> "abc12345-..."
 * @param userId The user ID to mask
 * @returns Masked user ID
 */
export function maskUserId(userId: string | null | undefined): string {
  if (!userId) {
    return '[REDACTED]';
  }

  // Show first 8 characters, mask the rest
  if (userId.length <= 8) {
    return '[REDACTED]';
  }

  return `${userId.substring(0, 8)}...`;
}

/**
 * Sanitizes an object by masking PII fields
 * Recursively processes objects and arrays
 * @param data The data object to sanitize
 * @param depth Maximum recursion depth (default: 5)
 * @returns Sanitized copy of the data
 */
export function sanitizeLogData(data: any, depth: number = 5): any {
  if (depth <= 0 || data === null || data === undefined) {
    return '[Max depth reached or null/undefined]';
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeLogData(item, depth - 1));
  }

  const sanitized: any = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    // Mask email fields
    if (lowerKey.includes('email')) {
      sanitized[key] = typeof value === 'string' ? maskEmail(value) : '[REDACTED]';
    }
    // Mask user ID fields (but not all IDs - be selective)
    else if (lowerKey.includes('userid') || lowerKey.includes('user_id') || 
             (lowerKey === 'id' && typeof value === 'string' && (value.length > 16 || value.includes('-')))) {
      // Mask UUIDs and long IDs (likely user IDs)
      if (typeof value === 'string' && (value.length > 16 || value.includes('-'))) {
        sanitized[key] = maskUserId(value);
      } else {
        sanitized[key] = value;
      }
    }
    // Keep short IDs (like booking numbers, etc.) as-is
    else if (lowerKey === 'id' && typeof value === 'string' && value.length <= 16 && !value.includes('-')) {
      sanitized[key] = value;
    }
    // Recursively sanitize nested objects
    else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeLogData(value, depth - 1);
    }
    // Keep other values as-is
    else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
