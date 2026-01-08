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
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  
  // File Upload
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().default('10485760').transform(Number).pipe(z.number().int().positive()),
  
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
  EMAILJS_TEMPLATE_ID: z.string().optional(),
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

// Export validated config
export const validatedConfig = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  database: {
    url: env.DATABASE_URL,
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
    templateId: env.EMAILJS_TEMPLATE_ID,
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
};

// Environment variables validated successfully

