// Logger utility using Winston
import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { sanitizeLogData } from './log-sanitizer';

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: { service: 'itad-backend' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Write errors to error.log
    new winston.transports.File({ 
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on handled exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  // Don't exit on unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logsDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
  }));
}

// Helper functions for structured logging with PII sanitization
export const logInfo = (message: string, meta?: Record<string, any>) => {
  logger.info(message, meta ? sanitizeLogData(meta) : undefined);
};

export const logError = (message: string, error?: Error | any, meta?: Record<string, any>) => {
  logger.error(message, sanitizeLogData({
    ...meta,
    error: error?.message,
    stack: error?.stack,
  }));
};

export const logWarn = (message: string, meta?: Record<string, any>) => {
  logger.warn(message, meta ? sanitizeLogData(meta) : undefined);
};

export const logDebug = (message: string, meta?: Record<string, any>) => {
  logger.debug(message, meta ? sanitizeLogData(meta) : undefined);
};

// Override logger methods to automatically sanitize PII
// Winston logger methods can be called with: (message, meta) or (meta) or (message)
const originalInfo = logger.info.bind(logger);
const originalError = logger.error.bind(logger);
const originalWarn = logger.warn.bind(logger);
const originalDebug = logger.debug.bind(logger);

logger.info = (messageOrMeta: any, ...args: any[]) => {
  if (typeof messageOrMeta === 'string') {
    // Format: logger.info(message, meta)
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      return originalInfo(messageOrMeta, sanitizeLogData(args[0]), ...args.slice(1));
    }
    return originalInfo(messageOrMeta, ...args);
  } else if (typeof messageOrMeta === 'object' && messageOrMeta !== null) {
    // Format: logger.info(meta)
    return originalInfo(sanitizeLogData(messageOrMeta), ...args);
  }
  return originalInfo(messageOrMeta, ...args);
};

logger.error = (messageOrMeta: any, ...args: any[]) => {
  if (typeof messageOrMeta === 'string') {
    // Format: logger.error(message, meta)
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      return originalError(messageOrMeta, sanitizeLogData(args[0]), ...args.slice(1));
    }
    return originalError(messageOrMeta, ...args);
  } else if (typeof messageOrMeta === 'object' && messageOrMeta !== null) {
    // Format: logger.error(meta)
    return originalError(sanitizeLogData(messageOrMeta), ...args);
  }
  return originalError(messageOrMeta, ...args);
};

logger.warn = (messageOrMeta: any, ...args: any[]) => {
  if (typeof messageOrMeta === 'string') {
    // Format: logger.warn(message, meta)
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      return originalWarn(messageOrMeta, sanitizeLogData(args[0]), ...args.slice(1));
    }
    return originalWarn(messageOrMeta, ...args);
  } else if (typeof messageOrMeta === 'object' && messageOrMeta !== null) {
    // Format: logger.warn(meta)
    return originalWarn(sanitizeLogData(messageOrMeta), ...args);
  }
  return originalWarn(messageOrMeta, ...args);
};

logger.debug = (messageOrMeta: any, ...args: any[]) => {
  if (typeof messageOrMeta === 'string') {
    // Format: logger.debug(message, meta)
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
      return originalDebug(messageOrMeta, sanitizeLogData(args[0]), ...args.slice(1));
    }
    return originalDebug(messageOrMeta, ...args);
  } else if (typeof messageOrMeta === 'object' && messageOrMeta !== null) {
    // Format: logger.debug(meta)
    return originalDebug(sanitizeLogData(messageOrMeta), ...args);
  }
  return originalDebug(messageOrMeta, ...args);
};

