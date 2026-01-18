import { PrismaClient } from '@prisma/client';
import { validatedConfig } from './env-validation';

// Determine database URL based on environment
// In development: use local PostgreSQL (DATABASE_URL)
// In production: use RDS (DATABASE_URL_PROD if set, otherwise DATABASE_URL)
const databaseUrl = validatedConfig.database.url;
const isProduction = validatedConfig.nodeEnv === 'production';
const isUsingRDS = isProduction && validatedConfig.database.urlProd && 
                   databaseUrl === validatedConfig.database.urlProd;

// Log which database is being used
if (isProduction) {
  if (isUsingRDS) {
    console.log('📊 Database: Using RDS (Production)');
    // Mask password in URL for logging
    const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
    console.log(`   Connection: ${maskedUrl}`);
  } else {
    console.log('📊 Database: Using DATABASE_URL (Production fallback)');
    console.warn('⚠️  WARNING: DATABASE_URL_PROD not set, using DATABASE_URL in production');
  }
} else {
  console.log('📊 Database: Using Local PostgreSQL (Development)');
  // Mask password in URL for logging
  const maskedUrl = databaseUrl.replace(/:([^:@]+)@/, ':****@');
  console.log(`   Connection: ${maskedUrl}`);
}

// Prisma Client singleton
// Note: Prisma reads DATABASE_URL from environment variable
// We need to set it in process.env for Prisma to use the correct URL
process.env.DATABASE_URL = databaseUrl;

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;

