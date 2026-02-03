// XSS Sanitization Utilities
import sanitizeHtml from 'sanitize-html';

/**
 * Configuration for sanitizing HTML content
 * Strips all HTML tags and returns plain text
 */
const STRIP_HTML_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [], // No HTML tags allowed
  allowedAttributes: {}, // No attributes allowed
  allowedSchemes: [], // No URL schemes allowed
};

/**
 * Configuration for sanitizing text fields that may contain basic formatting
 * Allows only safe, basic formatting tags if needed in the future
 */
const BASIC_TEXT_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [], // No HTML tags allowed by default
  allowedAttributes: {},
  allowedSchemes: [],
};

/**
 * Sanitizes a string input to prevent XSS attacks
 * Removes all HTML tags and potentially dangerous content
 * 
 * @param input - The string to sanitize
 * @param allowBasicFormatting - If true, allows basic formatting (currently unused, always strips HTML)
 * @returns Sanitized string with all HTML removed
 */
export function sanitizeInput(input: string | null | undefined, allowBasicFormatting: boolean = false): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Use appropriate config based on formatting needs
  const config = allowBasicFormatting ? BASIC_TEXT_CONFIG : STRIP_HTML_CONFIG;

  // Sanitize HTML content
  const sanitized = sanitizeHtml(trimmed, config);

  // Decode HTML entities that might have been encoded
  // This ensures that &lt;script&gt; becomes <script> and then gets stripped
  const decoded = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/');

  // Sanitize again after decoding to catch any newly revealed HTML
  return sanitizeHtml(decoded, config);
}

/**
 * Sanitizes an object by sanitizing all string properties
 * Useful for sanitizing request bodies before storing in database
 * 
 * @param obj - The object to sanitize
 * @param fieldsToSkip - Array of field names to skip sanitization (e.g., 'password', 'email')
 * @returns New object with sanitized string values
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fieldsToSkip: string[] = ['password', 'email', 'token', 'csrfToken']
): T {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj;
  }

  const sanitized = { ...obj };

  for (const [key, value] of Object.entries(sanitized)) {
    // Skip specified fields (like passwords, emails, tokens)
    if (fieldsToSkip.includes(key.toLowerCase())) {
      continue;
    }

    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeObject(value, fieldsToSkip);
    }
  }

  return sanitized;
}

/**
 * Sanitizes a string array (e.g., sealNumbers, photos array)
 * 
 * @param arr - Array of strings to sanitize
 * @returns New array with sanitized strings
 */
export function sanitizeStringArray(arr: (string | null | undefined)[] | null | undefined): string[] {
  if (!Array.isArray(arr)) {
    return [];
  }

  return arr
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .map(item => sanitizeInput(item));
}

/**
 * Sanitizes a single string field (convenience function)
 * 
 * @param value - String value to sanitize
 * @returns Sanitized string or empty string if invalid
 */
export function sanitizeString(value: string | null | undefined): string {
  return sanitizeInput(value);
}
