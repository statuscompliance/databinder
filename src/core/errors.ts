/**
 * Custom error classes for the DataBinder library
 * 
 * These error classes provide more specific error types for different failure scenarios,
 * which allows for better error handling in applications using the library.
 */

/**
 * Base error class for all DataBinder errors
 * Includes error code and contextual information
 */
export class DataBinderError extends Error {
  /** Unique error code */
  code: string;
  
  /** HTTP status code (if applicable) */
  status?: number;
  
  /** Additional contextual information about the error */
  context?: Record<string, any>;

  /**
   * @param message - Error message
   * @param code - Error code
   * @param status - HTTP status code (optional)
   * @param context - Additional context (optional)
   */
  constructor(
    message: string, 
    code: string = 'DATABINDER_ERROR', 
    status?: number,
    context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.context = context;
    
    // Maintain proper stack trace in Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Converts the error to a plain object for serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      status: this.status,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Error thrown when a datasource fails to initialize
 */
export class DatasourceInitError extends DataBinderError {
  constructor(
    message: string, 
    datasourceId?: string,
    datasourceType?: string,
    status?: number,
    context?: Record<string, any>
  ) {
    super(
      message, 
      'DATASOURCE_INIT_ERROR', 
      status,
      { 
        ...context,
        datasourceId,
        datasourceType
      }
    );
  }
}

/**
 * Error thrown when datasource configuration is missing or invalid
 */
export class InvalidConfigError extends DataBinderError {
  constructor(
    message: string, 
    propertyName?: string,
    expectedType?: string,
    receivedValue?: any,
    context?: Record<string, any>
  ) {
    super(
      message, 
      'INVALID_CONFIG_ERROR', 
      undefined,
      { 
        ...context,
        propertyName,
        expectedType,
        receivedValue: typeof receivedValue === 'object' ? 
          'object' : receivedValue // Avoid including sensitive data
      }
    );
  }
}

/**
 * Error thrown for authentication failures
 */
export class AuthenticationError extends DataBinderError {
  constructor(
    message: string, 
    authType?: string,
    status?: number,
    context?: Record<string, any>
  ) {
    super(
      message, 
      'AUTHENTICATION_ERROR', 
      status,
      { 
        ...context,
        authType
      }
    );
  }
}

/**
 * Error thrown for network-related failures
 */
export class NetworkError extends DataBinderError {
  constructor(
    message: string, 
    url?: string,
    method?: string,
    status?: number,
    context?: Record<string, any>
  ) {
    super(
      message, 
      'NETWORK_ERROR', 
      status,
      { 
        ...context,
        url: url ? new URL(url).origin + new URL(url).pathname : undefined, // Remove query params for security
        method
      }
    );
  }
}

/**
 * Error thrown when a resource is not found
 */
export class NotFoundError extends DataBinderError {
  constructor(
    message: string, 
    resourceType?: string,
    resourceId?: string,
    status?: number,
    context?: Record<string, any>
  ) {
    super(
      message, 
      'NOT_FOUND_ERROR', 
      status || 404,
      { 
        ...context,
        resourceType,
        resourceId
      }
    );
  }
}

/**
 * Error thrown when a timeout occurs
 */
export class TimeoutError extends NetworkError {
  constructor(
    message: string, 
    url?: string,
    method?: string,
    timeoutMs?: number,
    context?: Record<string, any>
  ) {
    super(
      message, 
      url,
      method,
      408, // Request Timeout
      { 
        ...context,
        timeoutMs
      }
    );
    this.code = 'TIMEOUT_ERROR';
  }
}

/**
 * Determines if an error is a specific HTTP status code
 * 
 * @param error - The error to check
 * @param statusCode - The HTTP status code to check for
 * @returns True if the error has the specified status code
 */
export function isHttpError(error: any, statusCode: number): boolean {
  return error && 
         (error.status === statusCode || 
          error.statusCode === statusCode || 
          (error.response && error.response.status === statusCode));
}

/**
 * Determines if an error is likely a network/connection error
 * 
 * @param error - The error to check
 * @returns True if the error is likely a network error
 */
export function isNetworkError(error: any): boolean {
  return error && (
    error instanceof NetworkError ||
    error.code === 'ECONNRESET' ||
    error.code === 'ECONNREFUSED' ||
    error.code === 'ENOTFOUND' ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('Network request failed')
  );
}

/**
 * Determines if an error is a server error (5xx status)
 * 
 * @param error - The error to check
 * @returns True if the error is a server error
 */
export function isServerError(error: any): boolean {
  const status = error.status || error.statusCode || (error.response && error.response.status);
  return status >= 500 && status < 600;
}

/**
 * Determines if an error is likely to be transient and retryable
 * 
 * @param error - The error to check
 * @returns True if the error is likely to be transient and retryable
 */
export function isRetryableError(error: any): boolean {
  return isNetworkError(error) || 
         isServerError(error) || 
         isHttpError(error, 429) || // Too Many Requests
         error instanceof TimeoutError;
}
