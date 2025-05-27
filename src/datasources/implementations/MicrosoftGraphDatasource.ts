import { Datasource, DatasourceConfig, DatasourceDefinition } from '../types';
import {
  RestApiConfig,
  RestApiMethodOptions,
  createRestApiBasedDatasource,
  fetchData
} from './RestApiDatasource';
import { getMicrosoftGraphToken } from '../../auth/tokenProvider';
import { 
  DatasourceInitError, 
  AuthenticationError, 
  InvalidConfigError 
} from '../../core/errors';
import { logger } from '../../core/logger';

export interface MicrosoftGraphConfig extends RestApiConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
}

export interface MicrosoftGraphOptions extends RestApiMethodOptions {
  siteId?: string;
  folderPath?: string;
  sitePath?: string;
  config: MicrosoftGraphConfig;
}

const microsoftGraphMethods = {
  listSiteItems: async (options?: MicrosoftGraphOptions) => {
    if (!options || !options.config) throw new Error('Missing config');
    const { siteId, folderPath, config } = options;
    if (!siteId || !folderPath) throw new Error('Missing siteId or folderPath');

    const encodedPath = encodeURIComponent(folderPath);
    const endpoint = `/sites/${siteId}/drive/root:/${encodedPath}:/children`;
    return fetchData(config, endpoint, options);
  },

  getSiteIdByPath: async (options?: MicrosoftGraphOptions) => {
    const { sitePath, config } = options ?? {};
    if (!sitePath) throw new Error('Missing sitePath');
    if (!config) throw new Error('Missing config');
    return fetchData(config, `/sites/${sitePath}`, options);
  }
};

/**
 * Creates a Microsoft Graph datasource instance with token acquisition
 * This version is async and used internally
 */
export async function createMicrosoftGraphDatasourceAsync(
  config: MicrosoftGraphConfig
): Promise<Datasource> {
  if (!config.tenantId || !config.clientId || !config.clientSecret) {
    throw new InvalidConfigError(
      'Microsoft Graph datasource requires tenantId, clientId, and clientSecret',
      undefined,
      undefined,
      undefined,
      { missingFields: ['tenantId', 'clientId', 'clientSecret'].filter(f => !config[f]) }
    );
  }

  logger.debug('Initializing Microsoft Graph datasource', { 
    tenantId: config.tenantId,
    clientId: config.clientId
  });

  try {
    const token = await getMicrosoftGraphToken(config);

    const mergedConfig: MicrosoftGraphConfig = {
      ...config,
      baseUrl: 'https://graph.microsoft.com/v1.0',
      auth: {
        type: 'bearer',
        token
      }
    };

    const instance = createRestApiBasedDatasource(
      config.id || 'microsoft-graph',
      'Microsoft Graph',
      'Datasource for Microsoft Graph API',
      mergedConfig,
      {}
    ).createInstance(mergedConfig);

    Object.entries(microsoftGraphMethods).forEach(([key, method]) => {
      instance.methods[key] = (options?: any) =>
        method({
          ...options,
          config: mergedConfig
        });
    });

    logger.info('Microsoft Graph datasource initialized successfully', {
      id: instance.id
    });

    return instance;
  } catch (error) {
    logger.error('Failed to initialize Microsoft Graph datasource', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Rethrow authentication errors
    if (error instanceof AuthenticationError) {
      throw error;
    }

    // Wrap other errors
    throw new DatasourceInitError(
      `Failed to initialize Microsoft Graph datasource: ${error instanceof Error ? error.message : String(error)}`,
      config.id,
      'microsoft-graph'
    );
  }
}

/**
 * Creates a Microsoft Graph datasource instance
 * This version is sync and returns a placeholder that will be initialized on first use
 */
export function createMicrosoftGraphDatasource(
  config: MicrosoftGraphConfig
): Datasource {
  // Create a placeholder datasource that will be fully initialized on first method call
  let initializedInstance: Datasource | null = null;
  let initializationPromise: Promise<Datasource> | null = null;
  let initializationError: Error | null = null;

  // Create a wrapper instance that will initialize the real instance on first use
  const wrapperInstance: Datasource = {
    id: config.id || 'microsoft-graph',
    definitionId: 'microsoft-graph',
    config: config,
    methods: {}
  };

  // Create dynamic method wrappers that ensure the datasource is initialized
  const ensureInitialized = async (): Promise<Datasource> => {
    // If already initialized, return the instance
    if (initializedInstance) {
      return initializedInstance;
    }

    // If already failed with an error, don't retry
    if (initializationError) {
      throw initializationError;
    }

    // If initialization is in progress, wait for it
    if (initializationPromise) {
      try {
        initializedInstance = await initializationPromise;
        return initializedInstance;
      } catch (error) {
        // Store the error for future calls
        initializationError = error instanceof Error 
          ? error 
          : new DatasourceInitError(String(error), config.id, 'microsoft-graph');
        throw initializationError;
      }
    }

    // Start initialization
    try {
      logger.debug('Lazy initializing Microsoft Graph datasource', { id: config.id });
      initializationPromise = createMicrosoftGraphDatasourceAsync(config);
      initializedInstance = await initializationPromise;
      return initializedInstance;
    } catch (error) {
      // Store the error for future calls
      initializationError = error instanceof Error 
        ? error 
        : new DatasourceInitError(String(error), config.id, 'microsoft-graph');
      logger.error('Failed to lazy initialize Microsoft Graph datasource', {
        error: initializationError.message
      });
      throw initializationError;
    }
  };

  // Generate placeholder methods that will delegate to the real instance once initialized
  Object.keys(microsoftGraphMethods).forEach(methodName => {
    wrapperInstance.methods[methodName] = async (options?: any) => {
      try {
        const instance = await ensureInitialized();
        return instance.methods[methodName](options);
      } catch (error) {
        // Add context to the error
        if (error instanceof Error) {
          logger.error(`Error in Microsoft Graph method ${methodName}`, { 
            error: error.message,
            methodName,
            options: JSON.stringify(options, null, 2).substring(0, 200) // Limit length for logging
          });
          
          // If it's already a custom error, just rethrow
          if (error instanceof DatasourceInitError || 
              error instanceof AuthenticationError || 
              error instanceof InvalidConfigError) {
            throw error;
          }
          
          // Otherwise wrap it
          throw new DatasourceInitError(
            `Error in Microsoft Graph method ${methodName}: ${error.message}`,
            config.id,
            'microsoft-graph'
          );
        }
        throw error;
      }
    };
  });

  return wrapperInstance;
}

export const MicrosoftGraphDatasource: DatasourceDefinition = {
  id: 'microsoft-graph',
  name: 'Microsoft Graph Datasource',
  description: 'REST API datasource for Microsoft Graph with dynamic token acquisition',
  configSchema: {
    type: 'object',
    required: ['tenantId', 'clientId', 'clientSecret'],
    properties: {
      tenantId: { type: 'string' },
      clientId: { type: 'string' },
      clientSecret: { type: 'string' },
      scopes: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  },
  createInstance: (config: DatasourceConfig): Datasource => {
    const graphConfig = config as MicrosoftGraphConfig;
    
    if (!graphConfig.tenantId || !graphConfig.clientId || !graphConfig.clientSecret) {
      throw new Error('Microsoft Graph datasource requires tenantId, clientId, and clientSecret');
    }
    
    return createMicrosoftGraphDatasource(graphConfig);
  }
};
