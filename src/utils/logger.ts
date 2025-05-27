import winston from 'winston';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';
import { LogMetadata } from './types';
import Transport from 'winston-transport';
import dotenv from 'dotenv';
import { getCurrentTraceContext } from './telemetry';

dotenv.config();

const isTestEnvironment = process.env.NODE_ENV === 'test' || false;
/* istanbul ignore next */
const isMongoLoggingEnabled = process.env.MONGO_LOGGING_ENABLED !== 'false';

// Schema for logs in MongoDB
const logSchema = new mongoose.Schema(
  {
    timestamp: Date,
    level: String,
    message: String,
    service: String,
    environment: String,
    host: String,
    pid: Number,
    requestId: String,
    userId: String,
    ip: String,
    url: String,
    method: String,
    statusCode: Number,
    stack: String,
    functionName: String,
    lineNumber: Number,
    metadata: Object,
  },
  { timestamps: true }
);

// Model for logs
let LogModel: mongoose.Model<any>;
try {
  LogModel = mongoose.model('Log');
} catch {
  LogModel = mongoose.model('Log', logSchema);
}

// Custom log levels with colors
const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    database: 5,
  },
  colors: {
    error: 'bold red',
    warn: 'bold yellow',
    info: 'bold green',
    http: 'bold cyan',
    debug: 'bold magenta',
    database: 'bold blue',
  },
};

// Add colors to winston
winston.addColors(customLevels.colors);

// Format timestamp to ISO
const formatTimestamp = (timestamp: string | number | Date): string => new Date(timestamp).toISOString();

// Format ID section
const formatIdSection = (requestId: string, userId: string): string => {
  if (requestId === '-' && userId === '-') return '[-]';
  if (requestId === '-') return `[${userId}]`;
  if (userId === '-') return `[${requestId}]`;
  return `[${requestId}] [${userId}]`;
};

// Format HTTP log
const formatHttpLog = (
  timestamp: string, 
  level: string, 
  idSection: string, 
  method: string, 
  url: string, 
  statusCode?: number
): string => {
  let httpInfo = `${method.padEnd(7)} ${url}`;
  if (statusCode) {
    const statusColor = statusCode >= 400 ? '\x1b[31m' : '\x1b[32m';
    httpInfo += ` ${statusColor}${statusCode}\x1b[0m`;
  }
  return `${timestamp} [${level.padEnd(5)}] ${idSection} ${httpInfo}`;
};

// Format error log
const formatErrorLog = (
  timestamp: string, 
  level: string, 
  idSection: string, 
  message: string, 
  stack: string
): string => {
  return `${timestamp} [${level.padEnd(5)}] ${idSection} ${message}\n${stack}`;
};

// Format connection log
const formatConnectionLog = (
  timestamp: string, 
  level: string, 
  idSection: string, 
  message: string, 
  metadata: Record<string, any>
): string => {
  const details: string[] = [];
  if (metadata.uri && metadata.uri !== '[REDACTED]') details.push(`uri: ${metadata.uri}`);
  if (metadata.database) details.push(`db: ${metadata.database}`);
  
  const infoStr = details.length > 0 ? `${message} (${details.join(', ')})` : message;
  return `${timestamp} [${level.padEnd(5)}] ${idSection} ${infoStr}`;
};

// Clean metadata by removing common fields
const cleanMetadata = (metadata: Record<string, any>): Record<string, any> => {
  const fieldsToRemove = [
    'service', 'environment', 'host', 'pid', 'requestId', 'userId', 
    'ip', 'url', 'method', 'stack', 'functionName', 'lineNumber', 
    'uri', 'database'
  ];
  
  const cleanedMeta = { ...metadata };
  fieldsToRemove.forEach(field => delete cleanedMeta[field]);
  return cleanedMeta;
};

// Main console format
const consoleFormat = winston.format.printf(({ level, message, timestamp, ...metadata }: any) => {
  // Extract main properties 
  const requestId = metadata.requestId || '-';
  const userId = metadata.userId || '-';
  const method = metadata.method || '';
  const url = metadata.url || '';
  const statusCode = metadata.statusCode || '';
  
  // Format timestamp and IDs
  const formattedDate = formatTimestamp(timestamp);
  let idSection = formatIdSection(requestId, userId);
  
  // Añadir información de trazado si está disponible
  const traceId = metadata.traceId || '';
  if (traceId) {
    idSection = `${idSection} [trace:${traceId.substring(0, 8)}]`;
  }
  
  // HTTP request logs
  if (method && url) {
    return formatHttpLog(formattedDate, level, idSection, method, url, statusCode);
  }
  
  // Error logs with stack trace
  if (metadata.stack) {
    return formatErrorLog(formattedDate, level, idSection, message as string, metadata.stack as string);
  }
  
  // Connection logs
  if (metadata.uri || metadata.database) {
    return formatConnectionLog(formattedDate, level, idSection, message as string, metadata);
  }
  
  // Basic format for other logs - remove host information
  const cleanedMeta = cleanMetadata(metadata);
  let formattedMessage = message;
  
  // Remove host information from the message if present
  if (typeof formattedMessage === 'string') {
    formattedMessage = formattedMessage.replace(/ \(host: .*?\)$/, '');
  }
  
  const metaString = Object.keys(cleanedMeta).length > 0 
    ? `\n${JSON.stringify(cleanedMeta, null, 2)}` 
    : '';
    
  return `${formattedDate} [${level.padEnd(5)}] ${idSection} ${formattedMessage}${metaString}`;
});

// Custom MongoDB transport
class MongoTransport extends Transport {
  name: string;
  
  constructor(opts: Transport.TransportStreamOptions) {
    super(opts);
    this.name = 'mongodb';
  }

  async log(info: any, callback: (() => void) | undefined): Promise<void> {
    try {
      await LogModel.create({
        timestamp: new Date(),
        level: info.level,
        message: info.message,
        service: info.service || 'databinder',
        environment: process.env.NODE_ENV || 'development',
        host: info.host || os.hostname(),
        pid: info.pid || process.pid,
        requestId: info.requestId || 'no-request-id',
        userId: info.userId || 'anonymous',
        ip: info.ip || '',
        url: info.url || '',
        method: info.method || '',
        statusCode: info.statusCode || null,
        stack: info.stack || '',
        functionName: info.functionName || '',
        lineNumber: info.lineNumber || 0,
        traceId: info.traceId || '',
        spanId: info.spanId || '',
        metadata: info.metadata || {},
      });
    } catch (error) {
      console.error('Error saving log to MongoDB:', error);
    }

    if (callback) {
      callback();
    }
  }
}

// Create logger instance
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'databinder',
    environment: process.env.NODE_ENV || 'development',
    host: os.hostname(),
    pid: process.pid,
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize({ all: true }),
        consoleFormat
      ),
    }),
    // Only add MongoDB transport if not in test environment and MongoDB logging is enabled
    ...(isTestEnvironment || !isMongoLoggingEnabled ? [] : [
      new MongoTransport({
        level: 'info',
      })
    ]),
  ],
  exitOnError: false,
});

// Function to initialize MongoDB connection for logs
export const initLogDB = async (): Promise<mongoose.Connection | null> => {
  // Skip MongoDB connection in test environment or if MongoDB logging is disabled
  if (isTestEnvironment || !isMongoLoggingEnabled) {
    const skipReason = isTestEnvironment ? 'Test environment detected' : 'MongoDB logging disabled';
    logger.info(`${skipReason} - skipping MongoDB logger initialization`);
    return null;
  }
  
  // Use a separate connection for logs
  const logConnection = mongoose.createConnection(
    process.env.MONGO_LOG_URI || 'mongodb://root:root@localhost:27017/statuslogs?authSource=admin'
  );
  
  // Register the model on this specific connection
  LogModel = logConnection.model('Log', logSchema);
  
  logger.info('Logger MongoDB connection initialized');
  return logConnection;
};

// Middleware to log HTTP request details
export const requestLogger = (req: any, res: any, next: () => void): void => {
  // Generate a unique ID for the request
  const requestId = uuidv4();
  req.requestId = requestId;

  // Capture the start time of the request
  const start = Date.now();

  // Event when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = req.user?.id || 'anonymous';
    
    // Determine log level based on status code
    const level = res.statusCode >= 400 ? 'warn' : 'http';
    
    // Obtener contexto de trazado actual
    const { traceId, spanId } = getCurrentTraceContext();
    
    logger[level](`${req.method} ${req.originalUrl}`, {
      requestId,
      userId,
      ip: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      url: req.originalUrl,
      method: req.method,
      statusCode: res.statusCode,
      duration,
      userAgent: req.headers['user-agent'],
      traceId,
      spanId
    });
  });

  next();
};

// Function to log errors with stack trace
export const logError = (error: Error, requestInfo: Partial<LogMetadata> = {}): void => {
  // Obtener contexto de trazado actual
  const traceContext = getCurrentTraceContext();
  
  const errorInfo = {
    ...requestInfo,
    stack: error.stack,
    message: error.message,
    traceId: requestInfo.traceId || traceContext.traceId,
    spanId: requestInfo.spanId || traceContext.spanId,
  };
  
  logger.error(`Error: ${error.message}`, errorInfo);
};

export default logger;