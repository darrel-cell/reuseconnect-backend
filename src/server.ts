import app from './app';
import { config } from './config/env';

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${config.nodeEnv}`);
  if (config.nodeEnv === 'development') {
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  }
});
