// File upload validation utilities
import { ValidationError } from './errors';

// Allowed image MIME types
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

// Maximum file size (15MB)
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes

/**
 * Validate base64 image string
 */
export function validateBase64Image(
  base64String: string,
  fieldName: string = 'image'
): void {
  if (!base64String || typeof base64String !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`);
  }

  // Check if it's a data URL
  if (!base64String.startsWith('data:')) {
    throw new ValidationError(`${fieldName} must be a valid base64 data URL`);
  }

  // Extract MIME type
  const mimeMatch = base64String.match(/data:([^;]+);base64,/);
  if (!mimeMatch) {
    throw new ValidationError(`${fieldName} must include a valid MIME type`);
  }

  const mimeType = mimeMatch[1];
  if (!ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${ALLOWED_IMAGE_TYPES.join(', ')}`
    );
  }

  // Extract base64 data
  const base64Data = base64String.split(',')[1];
  if (!base64Data) {
    throw new ValidationError(`${fieldName} must contain valid base64 data`);
  }

  // Calculate file size (approximate: base64 is ~33% larger than binary)
  const fileSize = (base64Data.length * 3) / 4;
  if (fileSize > MAX_FILE_SIZE) {
    throw new ValidationError(
      `${fieldName} size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    );
  }
}

/**
 * Validate array of base64 images
 */
export function validateBase64Images(
  images: string[],
  fieldName: string = 'images',
  maxCount: number = 10
): void {
  if (!Array.isArray(images)) {
    throw new ValidationError(`${fieldName} must be an array`);
  }

  if (images.length > maxCount) {
    throw new ValidationError(
      `${fieldName} cannot contain more than ${maxCount} images`
    );
  }

  images.forEach((image, index) => {
    if (image && typeof image === 'string' && image.trim().length > 0) {
      validateBase64Image(image, `${fieldName}[${index}]`);
    }
  });
}

/**
 * Validate file size from base64 string
 */
export function getBase64FileSize(base64String: string): number {
  if (!base64String || !base64String.includes(',')) {
    return 0;
  }
  const base64Data = base64String.split(',')[1];
  return (base64Data.length * 3) / 4;
}

