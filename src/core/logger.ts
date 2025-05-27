/**
 * Simple logging utility for DataBinder library
 * 
 * This provides a consistent logging interface that can be configured
 * based on application needs.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

export interface LoggerOptions {
  /** Minimum log level to output */
  level: LogLevel;
  
  /** Whether to include timestamps in log messages */
  timestamps?: boolean;
  
  /** Custom log handler function */
  logHandler?: (level: LogLevel, message: string, meta?: any) => void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

/**
 * Default logger implementation
 */
class LoggerImpl {
  private options: LoggerOptions = {
    level: 'info',
    timestamps: true
  };

  /**
   * Configures the logger
   * 
   * @param options - Logger configuration options
   */
  configure(options: Partial<LoggerOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Formats a log message with optional timestamp
   * 
   * @param level - Log level
   * @param message - Message to log
   * @returns Formatted log message
   */
  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = this.options.timestamps 
      ? `[${new Date().toISOString()}] `
      : '';
    return `${timestamp}[${level.toUpperCase()}] ${message}`;
  }

  /**
   * Logs a message if the level is enabled
   * 
   * @param level - Log level
   * @param message - Message to log
   * @param meta - Optional metadata to include
   */
  private log(level: LogLevel, message: string, meta?: any): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.options.level]) {
      return;
    }

    const formattedMessage = this.formatMessage(level, message);
    
    if (this.options.logHandler) {
      this.options.logHandler(level, formattedMessage, meta);
      return;
    }

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, meta ? meta : '');
        break;
      case 'info':
        console.info(formattedMessage, meta ? meta : '');
        break;
      case 'warn':
        console.warn(formattedMessage, meta ? meta : '');
        break;
      case 'error':
        console.error(formattedMessage, meta ? meta : '');
        break;
    }
  }

  /**
   * Logs a debug message
   * 
   * @param message - Message to log
   * @param meta - Optional metadata
   */
  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  /**
   * Logs an info message
   * 
   * @param message - Message to log
   * @param meta - Optional metadata
   */
  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  /**
   * Logs a warning message
   * 
   * @param message - Message to log
   * @param meta - Optional metadata
   */
  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  /**
   * Logs an error message
   * 
   * @param message - Message to log
   * @param meta - Optional metadata
   */
  error(message: string, meta?: any): void {
    this.log('error', message, meta);
  }
}

// Create singleton logger instance
export const logger = new LoggerImpl();

/**
 * Configure the global logger instance
 * 
 * @param options - Logger configuration options
 */
export function configureLogger(options: Partial<LoggerOptions>): void {
  logger.configure(options);
}
