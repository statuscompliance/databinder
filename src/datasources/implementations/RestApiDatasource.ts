import { Datasource, 
  DatasourceConfig, 
  DatasourceDefinition, 
  DatasourceMethodOptions, 
  PaginationOptions, 
  QueryOptions 
} from '../types';

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
 * 
 * @param config - The REST API configuration including baseUrl and authentication settings
 * @param endpoint - The endpoint to fetch data from
 * @param options - Additional options for the request including pagination, filtering, and response formatting
 * @returns A promise that resolves to the API response data
 */
export async function fetchData(
  config: RestApiConfig,
  endpoint: string,
  options?: RestApiMethodOptions
): Promise<any> {
  const finalEndpoint = options?.endpoint || endpoint;
  const url = buildUrl(config, finalEndpoint, options?.pagination, options?.query);
  
  const headers = new Headers({
    'Content-Type': 'application/json',
    ...config.headers
  });

  applyAuthentication(headers, config.auth, options?.authOverride);

  if (options?.headers) {
    Object.entries(options.headers).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

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

  try {
    const requestOptions: RequestInit = {
      ...config.requestOptions,
      headers,
      signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined
    };

    const response = await fetch(url, requestOptions);
    
    if (!response.ok && !(options?.responseOptions?.throwHttpErrors === false)) {
      throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
    }

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
    
    if (options?.responseOptions?.fullResponse) {
      return {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data: await response.json().catch(() => null),
        ok: response.ok
      };
    }

    if (options?.responseFormat === 'batch') {
      const data = await response.json();
      
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
    
    const data = await response.json();
    
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
    throw error;
  }
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
 */
function buildUrl(
  config: RestApiConfig, 
  endpoint: string,
  pagination?: PaginationOptions,
  query?: QueryOptions
): string {
  // Improved logging for diagnostics
  console.log(`Building URL for endpoint: ${endpoint}`);
  console.log(`Config: ${JSON.stringify(config || {})}`);
  
  if (!config) {
    throw new Error('REST API configuration is missing or undefined');
  }
  
  if (!config.baseUrl) {
    throw new Error('REST API baseUrl is missing or undefined');
  }
  
  const endpointKey = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
  const customEndpoint = config.endpoints && config.endpoints[endpointKey] 
    ? config.endpoints[endpointKey] 
    : endpoint;
  
  let url = new URL(customEndpoint, config.baseUrl);
  
  if (pagination?.enabled) {
    url.searchParams.append('page', String(pagination.startPage || 1));
    if (pagination.pageSize) {
      url.searchParams.append('pageSize', String(pagination.pageSize));
    }
  }
  
  if (query?.filters) {
    for (const [key, value] of Object.entries(query.filters)) {
      if (typeof value === 'object') {
        url.searchParams.append(key, JSON.stringify(value));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }
  
  if (query?.sort && query.sort.length > 0) {
    const sortParams = query.sort.map(s => `${s.field}:${s.direction}`).join(',');
    url.searchParams.append('sort', sortParams);
  }
  
  return url.toString();
}
