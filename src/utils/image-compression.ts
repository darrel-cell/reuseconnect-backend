// Image compression utilities for backend
import sharp from 'sharp';
import { logger } from './logger';

// Maximum file size: 15MB
export const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB in bytes

// Compression options for photos (evidence photos)
export const PHOTO_COMPRESSION_OPTIONS = {
  maxSizeMB: 2, // Target size: 2MB
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 85, // JPEG quality (0-100)
  format: 'jpeg' as const,
};

// Compression options for signatures (smaller, simpler images)
export const SIGNATURE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5, // Target size: 500KB
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 90, // PNG quality (0-100)
  format: 'png' as const,
};

/**
 * Compress a base64 image data URL
 * @param dataUrl - Base64 data URL string
 * @param options - Compression options
 * @returns Compressed image as base64 data URL
 */
export async function compressBase64Image(
  dataUrl: string,
  options: typeof PHOTO_COMPRESSION_OPTIONS | typeof SIGNATURE_COMPRESSION_OPTIONS = PHOTO_COMPRESSION_OPTIONS
): Promise<string> {
  try {
    // Extract base64 data and MIME type
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      throw new Error('Invalid base64 data URL format');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    // Convert base64 to buffer
    const inputBuffer = Buffer.from(base64Data, 'base64');

    // Check input size
    if (inputBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`Input image size (${(inputBuffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Create sharp instance
    let image = sharp(inputBuffer);

    // Resize if needed
    const metadata = await image.metadata();
    const needsResize = metadata.width && metadata.height && 
      (metadata.width > options.maxWidth || metadata.height > options.maxHeight);

    if (needsResize) {
      image = image.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Compress based on format
    let outputBuffer: Buffer;
    if (options.format === 'jpeg') {
      outputBuffer = await image
        .jpeg({ quality: options.quality, mozjpeg: true })
        .toBuffer();
    } else {
      outputBuffer = await image
        .png({ quality: options.quality, compressionLevel: 9 })
        .toBuffer();
    }

    // Check output size
    if (outputBuffer.length > MAX_FILE_SIZE) {
      logger.warn('Compressed image still exceeds max size', {
        originalSize: inputBuffer.length,
        compressedSize: outputBuffer.length,
        maxSize: MAX_FILE_SIZE,
      });
      // If still too large, try more aggressive compression
      if (options.format === 'jpeg') {
        outputBuffer = await image
          .jpeg({ quality: Math.max(50, options.quality - 20), mozjpeg: true })
          .toBuffer();
      }
    }

    // Convert back to base64 data URL
    const outputBase64 = outputBuffer.toString('base64');
    const outputMimeType = options.format === 'jpeg' ? 'image/jpeg' : 'image/png';
    
    return `data:${outputMimeType};base64,${outputBase64}`;
  } catch (error) {
    logger.error('Failed to compress image', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Return original if compression fails
    return dataUrl;
  }
}

/**
 * Compress a buffer image
 * @param buffer - Image buffer
 * @param options - Compression options
 * @returns Compressed image buffer
 */
export async function compressImageBuffer(
  buffer: Buffer,
  options: typeof PHOTO_COMPRESSION_OPTIONS | typeof SIGNATURE_COMPRESSION_OPTIONS = PHOTO_COMPRESSION_OPTIONS
): Promise<Buffer> {
  try {
    // Check input size
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Input image size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Create sharp instance
    let image = sharp(buffer);

    // Resize if needed
    const metadata = await image.metadata();
    const needsResize = metadata.width && metadata.height && 
      (metadata.width > options.maxWidth || metadata.height > options.maxHeight);

    if (needsResize) {
      image = image.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Compress based on format
    let outputBuffer: Buffer;
    if (options.format === 'jpeg') {
      outputBuffer = await image
        .jpeg({ quality: options.quality, mozjpeg: true })
        .toBuffer();
    } else {
      outputBuffer = await image
        .png({ quality: options.quality, compressionLevel: 9 })
        .toBuffer();
    }

    // Check output size
    if (outputBuffer.length > MAX_FILE_SIZE) {
      logger.warn('Compressed image still exceeds max size', {
        originalSize: buffer.length,
        compressedSize: outputBuffer.length,
        maxSize: MAX_FILE_SIZE,
      });
      // If still too large, try more aggressive compression
      if (options.format === 'jpeg') {
        outputBuffer = await image
          .jpeg({ quality: Math.max(50, options.quality - 20), mozjpeg: true })
          .toBuffer();
      }
    }

    return outputBuffer;
  } catch (error) {
    logger.error('Failed to compress image buffer', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Return original if compression fails
    return buffer;
  }
}
