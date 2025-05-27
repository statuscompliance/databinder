import { Datasource, 
  DatasourceConfig, 
  DatasourceDefinition, 
  DatasourceMethodOptions, 
  PaginationOptions, 
  QueryOptions 
} from '../types';
import { 
  NetworkError, 
  AuthenticationError, 
  InvalidConfigError,
  NotFoundError,
  TimeoutError,
  isHttpError 
} from '../../core/errors';
import { logger } from '../../core/logger';
import { withRetry } from '../../utils/retryUtils';
import { withSpan, SpanKind } from '../../utils/telemetry';

export interface RestApiConfig extends DatasourceConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  endpoints?: Record<string, string>;
  defaultEndpoint?: string;
  auth?: {
    type: 'cookie' | 'bearer' | 'basic' | 'custom';
    cookies?: Record<string, string>;
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
    headerValue?: string;
  };
  requestOptions?: RequestInit;
}

export interface RestApiMethodOptions extends DatasourceMethodOptions {
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  authOverride?: {
    type?: 'cookie' | 'bearer' | 'basic' | 'custom';
    token?: string;
    username?: string;
    password?: string;
    headerValue?: string;
    cookies?: Record<string, string>;
  };
  endpoint?: string;
  responseOptions?: {
    fullResponse?: boolean;
    throwHttpErrors?: boolean;
  };
  responseFormat?: 'full' | 'batch' | 'iterator' | 'stream';
  
  /**
   * Options for retry behavior
   */
  retryOptions?: {
    /** Maximum number of retry attempts */
    maxRetries?: number;
    
    /** Base delay between retries in milliseconds */
    baseDelay?: number;
    
    /** Whether to use exponential backoff */
    exponential?: boolean;
  };
  
  /**
   * HTTP method to use for the request
   */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  
  /**
   * Request body for POST, PUT, and PATCH requests
   */
  body?: any;
  
  /**
   * Optional datasource identifier
   */
  datasourceId?: string;
}

// Type definition for REST API based datasources
export type RestApiDatasourceType = Datasource & {
  config: RestApiConfig;
  methods: {
    default: (options?: RestApiMethodOptions) => Promise<any>;
    getById: (options?: RestApiMethodOptions & { id: string }) => Promise<any>;
    search: (options?: RestApiMethodOptions) => Promise<any>;
    [key: string]: (options?: any) => Promise<any>; // Allow additional methods
  };
};

/**
 * Creates a REST API datasource instance that can be used directly or as a base for other datasources
 * 
 * @param config - The REST API configuration
 * @param extraMethods - Additional methods to include in the datasource
 * @returns A REST API datasource instance
 */
export function createRestApiDatasource(
  config: RestApiConfig, 
  extraMethods: Record<string, (options?: any) => Promise<any>> = {}
): RestApiDatasourceType {
  if (!config.baseUrl) {
    throw new Error('REST API datasource requires a baseUrl configuration');
  }

  return {
    id: '',
    config,
    methods: {
      default: async (options?: RestApiMethodOptions) => {
        const endpoint = options?.endpoint || config.defaultEndpoint || '/data';
        return fetchData(config, endpoint, options);
      },
      getById: async (options?: RestApiMethodOptions & { id: string }) => {
        if (!options?.id) {
          throw new Error('getById method requires an id parameter');
        }
        const baseEndpoint = options?.endpoint || config.defaultEndpoint || '/data';
        const cleanEndpoint = baseEndpoint.endsWith('/') 
          ? baseEndpoint.slice(0, -1) 
          : baseEndpoint;
        return fetchData(config, `${cleanEndpoint}/${options.id}`, options);
      },
      search: async (options?: RestApiMethodOptions) => {
        const endpoint = options?.endpoint || config.defaultEndpoint || '/search';
        return fetchData(config, endpoint, options);
      },
      ...extraMethods
    }
  };
}

// Datasource definition for catalog registration
export const RestApiDatasource: DatasourceDefinition = {
  id: 'rest-api',
  name: 'REST API Datasource',
  description: 'Generic REST API data source with support for pagination, filtering, and authentication',
  configSchema: {
    type: 'object',
    required: ['baseUrl'],
    properties: {
      baseUrl: { type: 'string' },
      headers: { type: 'object' },
      timeout: { type: 'number' },
      endpoints: { type: 'object' },
      defaultEndpoint: { type: 'string' },
      auth: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['cookie', 'bearer', 'basic', 'custom'] },
          cookies: { type: 'object' },
          token: { type: 'string' },
          username: { type: 'string' },
          password: { type: 'string' },
          headerName: { type: 'string' },
          headerValue: { type: 'string' }
        }
      },
      requestOptions: { type: 'object' }
    }
  },
  createInstance: (config: DatasourceConfig): Datasource => {
    return createRestApiDatasource(config as RestApiConfig);
  }
};

/**
 * Helper function to create specialized REST API datasources 
 * based on the common RestApiDatasource
 * 
 * @param id - Unique identifier for this type of datasource
 * @param name - Display name for this datasource type
 * @param description - Description of this datasource type
 * @param baseConfig - Base configuration to apply
 * @param extraMethods - Additional methods specific to this datasource
 * @returns A DatasourceDefinition for the specialized REST API
 */
export function createRestApiBasedDatasource(
  id: string,
  name: string,
  description: string,
  baseConfig: Partial<RestApiConfig> = {},
  extraMethods: Record<string, (options?: any) => Promise<any>> = {}
): DatasourceDefinition {
  return {
    id,
    name,
    description,
    configSchema: RestApiDatasource.configSchema,
    createInstance: (config: DatasourceConfig): Datasource => {
      // Combine the base config with the provided config
      const mergedConfig: RestApiConfig = {
        ...baseConfig,
        ...(config as RestApiConfig)
      };
      
      return createRestApiDatasource(mergedConfig, extraMethods);
    }
  };
}

// Export utility functions for REST API

/**
 * Fetches data from a REST API with the specified configuration and options.
 * Includes retry logic for transient errors and standardized error handling.
 * 
 * @param config - The REST API configuration including baseUrl and authentication settings
 * @param endpoint - The endpoint to fetch data from
 * @param options - Additional options for the request including pagination, filtering, and response formatting
 * @returns A promise that resolves to the API response data
 * @throws NetworkError, AuthenticationError, or other specific error types based on the failure
 */
export async function fetchData(
  config: RestApiConfig,
  endpoint: string,
  options?: RestApiMethodOptions
): Promise<any> {
  // Extract retry options from the method options or use defaults
  const retryOptions = {
    maxRetries: options?.retryOptions?.maxRetries || 2,
    baseDelay: options?.retryOptions?.baseDelay || 300,
    timeout: config.timeout
  };

  // Use withRetry to handle transient failures
  return withRetry(async () => {
    // Implementar trazado distribuido
    return withSpan(`REST API ${options?.method || 'GET'} ${endpoint}`, async (span) => {
      try {
        logger.debug(`Making request to endpoint: ${endpoint}`, {
          baseUrl: config.baseUrl,
          method: options?.method || 'GET'
        });

        // Añadir atributos al span
        span.setAttribute('http.method', options?.method || 'GET');
        span.setAttribute('http.url', config.baseUrl + endpoint);
        span.setAttribute('databinder.datasource', 'rest-api');
        
        if (options?.datasourceId) {
          span.setAttribute('databinder.datasource.id', options.datasourceId);
        }

        const finalEndpoint = options?.endpoint || endpoint;
        const url = buildUrl(config, finalEndpoint, options?.pagination, options?.query);
        
        const headers = new Headers({
          'Content-Type': 'application/json',
          ...config.headers
        });

        // Apply authentication
        applyAuthentication(headers, config.auth, options?.authOverride);

        if (options?.headers) {
          Object.entries(options.headers).forEach(([key, value]) => {
            headers.set(key, value);
          });
        }

        // Handle cookies
        const cookies: string[] = [];
        const cookieMap: Record<string, string> = {};
        
        if (config.auth?.type === 'cookie' && config.auth.cookies) {
          Object.entries(config.auth.cookies).forEach(([name, value]) => {
            cookieMap[name] = encodeURIComponent(value);
          });
        }
        
        if (options?.authOverride?.type === 'cookie' && options.authOverride.cookies) {
          Object.entries(options.authOverride.cookies).forEach(([name, value]) => {
            cookieMap[name] = encodeURIComponent(value);
          });
        }
        
        if (options?.cookies) {
          Object.entries(options.cookies).forEach(([name, value]) => {
            cookieMap[name] = encodeURIComponent(value);
          });
        }
        
        for (const [name, value] of Object.entries(cookieMap)) {
          cookies.push(`${name}=${value}`);
        }

        if (cookies.length > 0) {
          headers.set('Cookie', cookies.join('; '));
        }

        // Create request options
        const requestOptions: RequestInit = {
          ...config.requestOptions,
          method: options?.method || 'GET',
          headers,
          signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined
        };

        // Add body for non-GET requests if provided
        if (options?.body && requestOptions.method !== 'GET') {
          requestOptions.body = typeof options.body === 'string' 
            ? options.body 
            : JSON.stringify(options.body);
        }

        // Make the request
        const response = await fetch(url, requestOptions);
        
        // Añadir atributos de respuesta al span
        span.setAttribute('http.status_code', response.status);
        span.setAttribute('http.status_text', response.statusText);
        
        // Handle HTTP errors
        if (!response.ok && !(options?.responseOptions?.throwHttpErrors === false)) {
          // Create appropriate error types based on status codes
          if (response.status === 401) {
            throw new AuthenticationError(
              `Authentication failed: ${response.statusText}`,
              config.auth?.type,
              response.status,
              { url, method: requestOptions.method }
            );
          } else if (response.status === 403) {
            throw new AuthenticationError(
              `Access forbidden: ${response.statusText}`,
              config.auth?.type,
              response.status,
              { url, method: requestOptions.method }
            );
          } else if (response.status === 404) {
            throw new NotFoundError(
              `Resource not found: ${response.statusText}`,
              'endpoint',
              endpoint,
              response.status,
              { url, method: requestOptions.method }
            );
          } else if (response.status >= 500) {
            throw new NetworkError(
              `Server error: ${response.statusText}`,
              url,
              requestOptions.method,
              response.status
            );
          } else {
            throw new NetworkError(
              `HTTP error ${response.status}: ${response.statusText}`,
              url,
              requestOptions.method,
              response.status
            );
          }
        }

        // Log successful request
        logger.debug(`Request succeeded: ${response.status} ${response.statusText}`, {
          endpoint: finalEndpoint,
          status: response.status
        });

        // Handle stream response format
        if (options?.responseFormat === 'stream') {
          return {
            stream: response.body,
            metadata: {
              timestamp: Date.now(),
              source: 'rest-api',
              status: response.status,
              headers: Object.fromEntries(response.headers.entries())
            }
          };
        }
        
        // Handle full response option
        if (options?.responseOptions?.fullResponse) {
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            data: await response.json().catch(() => null),
            ok: response.ok
          };
        }

        // Parse the JSON response
        let data;
        try {
          data = await response.json();
        } catch (error) {
          logger.warn(`Failed to parse JSON response from ${endpoint}`, { error });
          // Return empty object if JSON parsing fails but don't fail the request
          data = {};
        }

        // Handle batch response format
        if (options?.responseFormat === 'batch') {
          const items = Array.isArray(data) ? data : (data.items || data.data || [data]);
          
          return {
            data: items,
            metadata: {
              timestamp: Date.now(),
              source: 'rest-api',
              status: response.status,
              headers: Object.fromEntries(response.headers.entries()),
              totalItems: data.totalItems || items.length,
              currentPage: options.pagination?.startPage || 1,
              hasNextPage: items.length === (options.pagination?.pageSize || options.batchSize)
            }
          };
        }
        
        // Default response format
        return {
          data,
          metadata: {
            timestamp: Date.now(),
            source: 'rest-api',
            status: response.status,
            headers: Object.fromEntries(response.headers.entries())
          }
        };
      } catch (error) {
        // Handle AbortError (timeout)
        if (error instanceof DOMException && error.name === 'AbortError') {
          throw new TimeoutError(
            `Request timed out after ${config.timeout}ms`,
            buildUrl(config, endpoint, options?.pagination, options?.query),
            options?.method || 'GET',
            config.timeout
          );
        }
        
        // If it's already one of our custom errors, just rethrow it
        if (error instanceof NetworkError || 
            error instanceof AuthenticationError || 
            error instanceof InvalidConfigError ||
            error instanceof NotFoundError ||
            error instanceof TimeoutError) {
          throw error;
        }
        
        // Otherwise, convert to an appropriate error type
        logger.error(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new NetworkError(
          `Request failed: ${error instanceof Error ? error.message : String(error)}`,
          buildUrl(config, endpoint, options?.pagination, options?.query),
          options?.method || 'GET'
        );
      }
    }, {
      kind: SpanKind.CLIENT,
      attributes: {
        'databinder.datasource.type': 'rest-api',
        'databinder.endpoint': endpoint
      }
    });
  }, retryOptions);
}

/**
 * Applies authentication settings to the request headers.
 * 
 * @param headers - The Headers object to modify
 * @param auth - Authentication configuration from the datasource
 * @param override - Optional authentication override for this specific request
 */
function applyAuthentication(
  headers: Headers,
  auth?: RestApiConfig['auth'],
  override?: RestApiMethodOptions['authOverride']
): void {
  if (!auth && !override) return;
  
  if (override?.type && override.type !== auth?.type) {
    switch (override.type) {
      case 'bearer':
        if (override.token) {
          headers.set('Authorization', `Bearer ${override.token}`);
        }
        break;
      case 'basic':
        if (override.username && override.password) {
          const credentials = btoa(`${override.username}:${override.password}`);
          headers.set('Authorization', `Basic ${credentials}`);
        }
        break;
      case 'custom':
        if (auth?.headerName && override.headerValue) {
          headers.set(auth.headerName, override.headerValue);
        }
        break;
    }
    return;
  }

  switch (auth?.type) {
    case 'bearer':
      const token = override?.token || auth.token;
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      break;
    case 'basic':
      const username = override?.username || auth.username;
      const password = override?.password || auth.password;
      if (username && password) {
        const credentials = btoa(`${username}:${password}`);
        headers.set('Authorization', `Basic ${credentials}`);
      }
      break;
    case 'custom':
      if (auth.headerName) {
        const headerValue = override?.headerValue || auth.headerValue;
        if (headerValue) {
          headers.set(auth.headerName, headerValue);
        }
      }
      break;
  }
}

/**
 * Builds a URL for the REST API request, including query parameters for pagination and filtering.
 * 
 * @param config - The REST API configuration
 * @param endpoint - The endpoint to call
 * @param pagination - Optional pagination settings
 * @param query - Optional query parameters for filtering and sorting
 * @returns The complete URL as a string
 * @throws InvalidConfigError if required configuration is missing
 */
function buildUrl(
  config: RestApiConfig, 
  endpoint: string,
  pagination?: PaginationOptions,
  query?: QueryOptions
): string {
  // Import sanitize utilities
  const { sanitizeString, sanitizeQueryParam, sanitizeUrl } = require('../../utils/sanitize');
  
  logger.debug(`Building URL for endpoint: ${endpoint}`, {
    baseUrl: config.baseUrl
  });
  
  if (!config) {
    throw new InvalidConfigError(
      'REST API configuration is missing or undefined',
      'config',
      'object',
      undefined
    );
  }
  
  if (!config.baseUrl) {
    throw new InvalidConfigError(
      'REST API baseUrl is missing or undefined',
      'baseUrl',
      'string',
      config.baseUrl
    );
  }
  
  // Sanitize the endpoint
  const sanitizedEndpoint = sanitizeString(endpoint);
  const endpointKey = sanitizedEndpoint.startsWith('/') ? sanitizedEndpoint.substring(1) : sanitizedEndpoint;
  const customEndpoint = config.endpoints && config.endpoints[endpointKey] 
    ? sanitizeString(config.endpoints[endpointKey]) 
    : sanitizedEndpoint;
  
  // Ensure baseUrl is a valid URL
  const safeBaseUrl = sanitizeUrl(config.baseUrl);
  if (!safeBaseUrl) {
    throw new InvalidConfigError(
      'REST API baseUrl is invalid',
      'baseUrl',
      'url',
      config.baseUrl
    );
  }
  
  let url = new URL(customEndpoint, safeBaseUrl);
  
  if (pagination?.enabled) {
    url.searchParams.append('page', String(pagination.startPage || 1));
    if (pagination.pageSize) {
      url.searchParams.append('pageSize', String(pagination.pageSize));
    }
  }
  
  if (query?.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      const safeKey = sanitizeString(key);
      
      if (typeof value === 'object') {
        url.searchParams.append(safeKey, sanitizeQueryParam(JSON.stringify(value)));
      } else {
        url.searchParams.append(safeKey, sanitizeQueryParam(String(value)));
      }
    }
  }
  
  if (query?.sort && query.sort.length > 0) {
    const sortParams = query.sort.map(s => {
      const safeField = sanitizeString(s.field);
      const safeDirection = s.direction === 'desc' ? 'desc' : 'asc';
      return `${safeField}:${safeDirection}`;
    }).join(',');
    
    url.searchParams.append('sort', sortParams);
  }
  
  return url.toString();
}
