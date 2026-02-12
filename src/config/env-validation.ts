// Environment variable validation using Zod
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Define environment schema
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number).pipe(z.number().int().positive()),
  
  // Database
  // In development: use DATABASE_URL (local PostgreSQL)
  // In production: use DATABASE_URL_PROD (RDS) if set, otherwise fall back to DATABASE_URL
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DATABASE_URL_PROD: z.string().url('DATABASE_URL_PROD must be a valid URL').optional(),
  
  // JWT
  // JWT_SECRET: Minimum 32 characters (cryptographically secure), maximum 512 characters (performance limit)
  // Recommended: 64-256 characters for optimal security and performance
  JWT_SECRET: z.string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .max(512, 'JWT_SECRET must not exceed 512 characters (performance limit)'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // File Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('52428800').transform(Number).pipe(z.number().int().positive()), // 50MB default
  
  // ERP
  MOCK_ERP_ENABLED: z.string().default('true').transform(val => val !== 'false'),
  ERP_BASE_URL: z.string().url().optional(),
  
  // Warehouse
  WAREHOUSE_POSTCODE: z.string().default('RM13 8BT'),
  WAREHOUSE_LAT: z.string().default('51.5174').transform(Number).pipe(z.number()),
  WAREHOUSE_LNG: z.string().default('0.1904').transform(Number).pipe(z.number()),
  
  // Email
  EMAILJS_ENABLED: z.string().default('true').transform(val => val !== 'false'),
  EMAILJS_SERVICE_ID: z.string().optional(),
  EMAILJS_TEMPLATE_ID: z.string().optional(), // Default template (for invitation emails)
  EMAILJS_TEMPLATE_ID_INVITE_ACCEPTED: z.string().optional(), // Template for invitation accepted emails
  EMAILJS_TEMPLATE_ID_BOOKING_CREATED: z.string().optional(), // Template for booking created emails
  EMAILJS_TEMPLATE_ID_TWO_FACTOR: z.string().optional(), // Template for 2FA verification code emails
  EMAILJS_PUBLIC_KEY: z.string().optional(),
  EMAILJS_PRIVATE_KEY: z.string().optional(),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SUPPORT_EMAIL: z.string().email().default('support@example.com'),
  
  // CORS
  CORS_ORIGIN: z.string().url().optional(),
  
  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number).pipe(z.number().int().positive()), // 15 minutes default
  RATE_LIMIT_MAX_REQUESTS: z.string().default('1000').transform(Number).pipe(z.number().int().positive()), // Higher default for development
  RATE_LIMIT_AUTH_MAX: z.string().default('20').transform(Number).pipe(z.number().int().positive()), // Auth endpoint limit
  
  // Routing API (optional - for road distance calculations)
  OPENROUTESERVICE_API_KEY: z.string().optional(), // OpenRouteService API key (optional, falls back to OSRM if not provided)
  
  // AWS S3 Storage (optional - for file storage)
  // If not explicitly set, automatically uses S3 in production, local storage in development
  USE_S3_STORAGE: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
  AWS_S3_BASE_URL: z.string().url().optional(),
});

// Validate environment variables
type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error: unknown) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed:');
    error.issues.forEach((err: z.ZodIssue) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

// Determine which database URL to use based on environment
const getDatabaseUrl = (): string => {
  // In production, prefer DATABASE_URL_PROD (RDS) if set
  if (env.NODE_ENV === 'production' && env.DATABASE_URL_PROD) {
    return env.DATABASE_URL_PROD;
  }
  // Otherwise, use DATABASE_URL (local PostgreSQL for development, or fallback in production)
  return env.DATABASE_URL;
};

// Export validated config
export const validatedConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  database: {
    url: getDatabaseUrl(),
    // Store both URLs for reference
    urlDev: env.DATABASE_URL,
    urlProd: env.DATABASE_URL_PROD,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  upload: {
    dir: env.UPLOAD_DIR,
    maxFileSize: env.MAX_FILE_SIZE,
  },
  erp: {
    mockEnabled: env.MOCK_ERP_ENABLED,
    baseUrl: env.ERP_BASE_URL,
  },
  warehouse: {
    postcode: env.WAREHOUSE_POSTCODE,
    lat: env.WAREHOUSE_LAT,
    lng: env.WAREHOUSE_LNG,
  },
  email: {
    enabled: env.EMAILJS_ENABLED,
    serviceId: env.EMAILJS_SERVICE_ID,
    templateId: env.EMAILJS_TEMPLATE_ID, // Default template (for invitation emails)
    templateIdInviteAccepted: env.EMAILJS_TEMPLATE_ID_INVITE_ACCEPTED, // Required for invitation accepted emails
    templateIdBookingCreated: env.EMAILJS_TEMPLATE_ID_BOOKING_CREATED, // Required for booking created emails
    templateIdTwoFactor: env.EMAILJS_TEMPLATE_ID_TWO_FACTOR, // Required for 2FA verification code emails
    publicKey: env.EMAILJS_PUBLIC_KEY,
    privateKey: env.EMAILJS_PRIVATE_KEY,
    frontendUrl: env.FRONTEND_URL,
    supportEmail: env.SUPPORT_EMAIL,
  },
  cors: {
    origin: env.CORS_ORIGIN || env.FRONTEND_URL,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    authMax: env.RATE_LIMIT_AUTH_MAX,
  },
  routing: {
    openRouteServiceApiKey: env.OPENROUTESERVICE_API_KEY,
  },
  s3: {
    // Auto-detect: Use S3 in production, local storage in development
    // NODE_ENV takes precedence - USE_S3_STORAGE can only override if explicitly set
    // Only enable S3 if credentials are provided
    useS3: (() => {
      const hasCredentials = !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET_NAME);
      
      // In development, always use local storage unless USE_S3_STORAGE is explicitly set to 'true'
      if (env.NODE_ENV === 'development') {
        if (env.USE_S3_STORAGE === 'true') {
          if (!hasCredentials) {
            console.warn('⚠️  WARNING: USE_S3_STORAGE=true in development but AWS credentials are missing. S3 will not work.');
          }
          return true; // Explicitly enabled in dev
        }
        return false; // Default to local storage in development
      }
      
      // In production, use S3 if credentials are provided
      // USE_S3_STORAGE=false can override to disable S3 even in production
      if (env.NODE_ENV === 'production') {
        if (env.USE_S3_STORAGE === 'false') {
          return false; // Explicitly disabled in production
        }
        if (!hasCredentials) {
          console.warn('⚠️  WARNING: NODE_ENV=production but AWS credentials are missing. S3 will not be enabled.');
        }
        return hasCredentials; // Auto-enable S3 in production if credentials exist
      }
      
      // Default to local storage for other environments (test, etc.)
      return false;
    })(),
    region: env.AWS_REGION || 'eu-west-2',
    accessKeyId: env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
    bucketName: env.AWS_S3_BUCKET_NAME || '',
    baseUrl: env.AWS_S3_BASE_URL,
  },
};

// Environment variables validated successfully

