import { Datasource, DatasourceConfig, DatasourceDefinition } from '../types';
import {
  RestApiConfig,
  RestApiMethodOptions,
  createRestApiBasedDatasource,
  fetchData
} from './RestApiDatasource';

import { getMicrosoftGraphToken } from '../../auth/tokenProvider';

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

  return instance;
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

  // Create a wrapper instance that will initialize the real instance on first use
  const wrapperInstance: Datasource = {
    id: config.id || 'microsoft-graph',
    definitionId: 'microsoft-graph',
    config: config,
    methods: {}
  };

  // Create dynamic method wrappers that ensure the datasource is initialized
  const ensureInitialized = async (): Promise<Datasource> => {
    if (initializedInstance) {
      return initializedInstance;
    }

    if (!initializationPromise) {
      initializationPromise = createMicrosoftGraphDatasourceAsync(config);
    }

    initializedInstance = await initializationPromise;
    return initializedInstance;
  };

  // Generate placeholder methods that will delegate to the real instance once initialized
  Object.keys(microsoftGraphMethods).forEach(methodName => {
    wrapperInstance.methods[methodName] = async (options?: any) => {
      const instance = await ensureInitialized();
      return instance.methods[methodName](options);
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
