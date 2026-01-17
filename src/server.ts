import app from './app';
import { config } from './config/env';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  
  // Display storage configuration
  const storageType = config.s3.useS3 ? 'S3 (AWS)' : 'Local (uploads folder)';
  console.log(`📦 File Storage: ${storageType}`);
  
  if (config.nodeEnv === 'development') {
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  }
});
