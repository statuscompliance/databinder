/**
 * Utility functions for implementing retry logic
 */
import { logger } from '../core/logger';
import { isRetryableError, TimeoutError } from '../core/errors';

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Base delay between retries in milliseconds */
  baseDelay?: number;
  
  /** Whether to use exponential backoff */
  exponential?: boolean;
  
  /** Maximum delay between retries in milliseconds */
  maxDelay?: number;
  
  /** Jitter factor to add randomness to delays (0-1) */
  jitter?: number;
  
  /** Timeout for each attempt in milliseconds */
  timeout?: number;
  
  /** Custom function to determine if an error is retryable */
  retryCondition?: (error: any, attempt: number) => boolean;
  
  /** Optional abort signal to cancel retries */
  signal?: AbortSignal;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 300,
  exponential: true,
  maxDelay: 10000,
  jitter: 0.3,
  timeout: 30000
};

/**
 * Calculates the delay for a retry attempt
 * 
 * @param attempt - Current attempt number (0-based)
 * @param options - Retry options
 * @returns Delay in milliseconds
 */
function calculateDelay(attempt: number, options: RetryOptions): number {
  const { baseDelay = 300, exponential = true, maxDelay = 10000, jitter = 0.3 } = options;
  
  // Calculate base delay with or without exponential backoff
  let delay = exponential 
    ? Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    : baseDelay;
  
  // Add jitter if specified (randomness to prevent thundering herd problem)
  if (jitter > 0) {
    const randomFactor = 1 - jitter + (Math.random() * jitter * 2);
    delay = Math.floor(delay * randomFactor);
  }
  
  return delay;
}

/**
 * Executes a function with retry logic
 * 
 * @param fn - Function to execute with retry logic
 * @param options - Retry options
 * @returns Promise that resolves with the result of fn or rejects after all retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>, 
  options: RetryOptions = {}
): Promise<T> {
  const mergedOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const maxRetries = mergedOptions.maxRetries || 0;
  
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a timeout if specified
      let timeoutId: any;
      const timeoutPromise = mergedOptions.timeout 
        ? new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject(new TimeoutError(
                `Operation timed out after ${mergedOptions.timeout}ms`,
                undefined,
                undefined,
                mergedOptions.timeout
              ));
            }, mergedOptions.timeout);
          })
        : null;
        
      // Execute the function with timeout if specified
      const result = timeoutPromise 
        ? await Promise.race([fn(), timeoutPromise])
        : await fn();
        
      // Clear timeout if it was set
      if (timeoutId) clearTimeout(timeoutId);
      
      return result as T;
      
    } catch (error) {
      lastError = error;
      
      const isRetryable = mergedOptions.retryCondition 
        ? mergedOptions.retryCondition(error, attempt)
        : isRetryableError(error);
        
      const hasMoreAttempts = attempt < maxRetries;
      
      // Check if we should abort due to abort signal
      if (mergedOptions.signal?.aborted) {
        logger.debug(`Retry aborted after attempt ${attempt + 1}`);
        throw lastError;
      }
      
      // Check if we should retry
      if (isRetryable && hasMoreAttempts) {
        const delay = calculateDelay(attempt, mergedOptions);
        logger.debug(
          `Retry attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms`,
          { error: error instanceof Error ? error.message : String(error) }
        );
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // No more retries or not retryable
      throw lastError;
    }
  }
  
  // This should never happen but TypeScript requires it
  throw lastError;
}

/**
 * Decorator factory that adds retry logic to a class method
 * 
 * @param options - Retry options
 * @returns Method decorator
 */
export function retry(options: RetryOptions = {}) {
  return function(
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function(...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };
    
    return descriptor;
  };
}
