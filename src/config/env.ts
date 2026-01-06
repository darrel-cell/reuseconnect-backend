import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  upload: {
    dir: process.env.UPLOAD_DIR || './uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  },
  erp: {
    mockEnabled: process.env.MOCK_ERP_ENABLED !== 'false',
    baseUrl: process.env.ERP_BASE_URL || 'http://localhost:3001/api/erp',
  },
  warehouse: {
    postcode: process.env.WAREHOUSE_POSTCODE || 'RM13 8BT',
    lat: parseFloat(process.env.WAREHOUSE_LAT || '51.5174'),
    lng: parseFloat(process.env.WAREHOUSE_LNG || '0.1904'),
  },
  email: {
    enabled: process.env.EMAILJS_ENABLED !== 'false',
    serviceId: process.env.EMAILJS_SERVICE_ID || '',
    templateId: process.env.EMAILJS_TEMPLATE_ID || '',
    publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
    privateKey: process.env.EMAILJS_PRIVATE_KEY || '', // Optional but recommended for Node.js
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
  },
};

