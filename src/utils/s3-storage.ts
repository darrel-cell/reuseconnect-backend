// S3 Storage Utility - Handles file uploads to AWS S3
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { validatedConfig } from '../config/env-validation';
import { logger } from './logger';

// Initialize S3 client only if S3 is enabled
let s3Client: S3Client | null = null;

if (validatedConfig.s3.useS3) {
  s3Client = new S3Client({
    region: validatedConfig.s3.region,
    credentials: {
      accessKeyId: validatedConfig.s3.accessKeyId,
      secretAccessKey: validatedConfig.s3.secretAccessKey,
    },
  });
}

export interface UploadFileOptions {
  file: Buffer | string; // Buffer for binary files, string for base64
  fileName: string;
  folder: 'evidence/photos' | 'evidence/signatures' | 'documents';
  contentType: string;
  isBase64?: boolean;
}

export interface UploadResult {
  url: string;
  key: string;
  size: number;
}

/**
 * Upload file to S3
 */
export async function uploadToS3(options: UploadFileOptions): Promise<UploadResult> {
  if (!validatedConfig.s3.useS3 || !s3Client) {
    throw new Error('S3 storage is not enabled. Set USE_S3_STORAGE=true in environment variables.');
  }

  const { file, fileName, folder, contentType, isBase64 = false } = options;

  // Convert base64 to buffer if needed
  let fileBuffer: Buffer;
  if (isBase64 && typeof file === 'string') {
    // Extract base64 data from data URL if present
    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    fileBuffer = Buffer.from(base64Data, 'base64');
  } else if (Buffer.isBuffer(file)) {
    fileBuffer = file;
  } else {
    throw new Error('Invalid file format. Expected Buffer or base64 string.');
  }

  // Generate S3 key (path)
  const timestamp = Date.now();
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${folder}/${sanitizedFileName}-${timestamp}`;

  try {
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: validatedConfig.s3.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      // Make files private by default (use presigned URLs for access)
      // ACL: 'private', // Not needed, files are private by default
    });

    await s3Client!.send(command);

    // Generate public URL or return key
    const url = validatedConfig.s3.baseUrl 
      ? `${validatedConfig.s3.baseUrl}/${key}`
      : key; // Fallback to key if base URL not configured

    logger.info('File uploaded to S3', {
      key,
      folder,
      fileName: sanitizedFileName,
      size: fileBuffer.length,
      contentType,
    });

    return {
      url,
      key,
      size: fileBuffer.length,
    };
  } catch (error) {
    logger.error('Failed to upload file to S3', {
      error,
      key,
      folder,
      fileName,
    });
    throw new Error(`Failed to upload file to S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Upload multiple files to S3
 */
export async function uploadMultipleToS3(
  files: Array<{ file: Buffer | string; fileName: string; contentType: string; isBase64?: boolean }>,
  folder: 'evidence/photos' | 'evidence/signatures' | 'documents'
): Promise<UploadResult[]> {
  const uploadPromises = files.map((fileData, index) => {
    const fileName = fileData.fileName || `file-${index}`;
    return uploadToS3({
      ...fileData,
      fileName,
      folder,
    });
  });

  return Promise.all(uploadPromises);
}

/**
 * Get presigned URL for private S3 object (expires in 1 hour by default)
 */
export async function getPresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
  if (!validatedConfig.s3.useS3 || !s3Client) {
    throw new Error('S3 storage is not enabled.');
  }

  try {
    const command = new GetObjectCommand({
      Bucket: validatedConfig.s3.bucketName,
      Key: key,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    logger.error('Failed to generate presigned URL', { error, key });
    throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  if (!validatedConfig.s3.useS3 || !s3Client) {
    throw new Error('S3 storage is not enabled.');
  }

  try {
    const command = new DeleteObjectCommand({
      Bucket: validatedConfig.s3.bucketName,
      Key: key,
    });

    await s3Client!.send(command);
    logger.info('File deleted from S3', { key });
  } catch (error) {
    logger.error('Failed to delete file from S3', { error, key });
    throw new Error(`Failed to delete file from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if S3 is enabled
 */
export function isS3Enabled(): boolean {
  return validatedConfig.s3.useS3;
}

/**
 * Extract S3 key from URL
 */
export function extractS3KeyFromUrl(url: string): string | null {
  // If URL contains the bucket name and key pattern
  const match = url.match(/\/evidence\/.+|\/documents\/.+/);
  if (match) {
    return match[0].replace(/^\//, ''); // Remove leading slash
  }
  
  // If it's already a key (just the path)
  if (url.startsWith('evidence/') || url.startsWith('documents/')) {
    return url;
  }

  return null;
}
