import { PrismaClient } from '@prisma/client';
import { validatedConfig } from './env-validation';

// Determine database URL based on environment
// In development: use local PostgreSQL (DATABASE_URL)
// In production: use RDS (DATABASE_URL_PROD if set, otherwise DATABASE_URL)
const databaseUrl = validatedConfig.database.url;
const isProduction = validatedConfig.nodeEnv === 'production';
const isUsingRDS = isProduction && validatedConfig.database.urlProd && 
                   databaseUrl === validatedConfig.database.urlProd;

// Log database connection status only (no URLs or credentials)
// Security: Never log database URLs or connection strings, even masked
if (isProduction) {
  if (isUsingRDS) {
    console.log('📊 Database: Using RDS (Production) - Connection configured');
  } else {
    console.log('📊 Database: Using DATABASE_URL (Production fallback) - Connection configured');
    console.warn('⚠️  WARNING: DATABASE_URL_PROD not set, using DATABASE_URL in production');
  }
} else {
  console.log('📊 Database: Using Local PostgreSQL (Development) - Connection configured');
}

// Prisma Client singleton
// Note: Prisma reads DATABASE_URL from environment variable
// We need to set it in process.env for Prisma to use the correct URL
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

/**
 * Test database connection without logging sensitive information
 * This can be called on startup to verify connectivity
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection: Successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection: Failed');
    // Log error details but not connection strings
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
    return false;
  }
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

