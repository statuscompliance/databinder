/**
 * OwnCloud WebDAV Datasource Implementation
 * 
 * Provides a specialized datasource for interacting with ownCloud servers
 * using the WebDAV protocol. Supports file operations, collections management,
 * and document parsing.
 */

import { 
  Datasource, 
  DatasourceConfig, 
  DatasourceDefinition,
  DatasourceMethodOptions 
} from '../types';
import { 
  WebDAVRequestConfig,
  propfind,
  getFileContent,
  putFileContent,
  deleteResource,
  createCollection as createWebDAVCollection,
  copyResource,
  moveResource,
  formatBytes,
  WebDAVItem
} from '../../utils/webdavUtils';
import { 
  parseDocument,
  detectDocumentFormat,
  DocumentMetadata,
  ParsedDocument 
} from '../../utils/documentUtils';
import { logger } from '../../core/logger';
import { 
  InvalidConfigError, 
  NetworkError,
  NotFoundError 
} from '../../core/errors';
import { withRetry } from '../../utils/retryUtils';
import { withSpan, SpanKind } from '../../utils/telemetry';

/**
 * Configuration for ownCloud WebDAV datasource
 */
export interface OwnCloudConfig extends DatasourceConfig {
  /** Base URL of the ownCloud instance (e.g., http://localhost:8080) */
  baseUrl: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Timeout for requests in milliseconds (default: 30000) */
  timeout?: number;
  /** Additional headers to include in requests */
  headers?: Record<string, string>;
  /** WebDAV root path (default: /remote.php/dav/files) */
  webdavRoot?: string;
  /** Whether to enable retry logic (default: true) */
  enableRetry?: boolean;
  /** Maximum number of retries (default: 2) */
  maxRetries?: number;
}

/**
 * Method options for ownCloud operations
 */
export interface OwnCloudMethodOptions extends DatasourceMethodOptions {
  /** Path to the file or collection relative to the user's root */
  path?: string;
  /** Depth for PROPFIND requests (0 = resource only, 1 = resource + children, infinity = all) */
  depth?: '0' | '1' | 'infinity';
  /** Custom headers for this request */
  headers?: Record<string, string>;
  /** Whether to return the full response or just the data */
  fullResponse?: boolean;
  /** Whether to parse document content (for supported formats) */
  parseContent?: boolean;
  /** Whether to return content as binary (ArrayBuffer) */
  asBinary?: boolean;
  /** Custom properties to request in PROPFIND */
  customProps?: string[];
  /** Content to upload (for uploadFile) */
  content?: string | ArrayBuffer | Buffer;
  /** Destination path (for copy/move operations) */
  destination?: string;
  /** Whether to overwrite existing files (for copy/move operations) */
  overwrite?: boolean;
}

/**
 * ownCloud datasource type
 */
export type OwnCloudDatasourceType = Datasource & {
  config: OwnCloudConfig;
  methods: {
    /** Get file content */
    getFileContent: (options: OwnCloudMethodOptions & { path: string }) => Promise<any>;
    /** Get parsed document with content and metadata */
    getDocument: (options: OwnCloudMethodOptions & { path: string }) => Promise<ParsedDocument>;
    /** List collections (directories) */
    listCollections: (options?: OwnCloudMethodOptions) => Promise<WebDAVItem[]>;
    /** List files in a collection */
    listFiles: (options: OwnCloudMethodOptions & { path: string }) => Promise<WebDAVItem[]>;
    /** List all items recursively */
    listRecursive: (options?: OwnCloudMethodOptions) => Promise<WebDAVItem[]>;
    /** Get file properties */
    getFileProperties: (options: OwnCloudMethodOptions & { path: string }) => Promise<WebDAVItem>;
    /** Upload a file */
    uploadFile: (options: OwnCloudMethodOptions & { path: string; content: any }) => Promise<any>;
    /** Delete a file or collection */
    delete: (options: OwnCloudMethodOptions & { path: string }) => Promise<any>;
    /** Create a collection (directory) */
    createCollection: (options: OwnCloudMethodOptions & { path: string }) => Promise<any>;
    /** Copy a file or collection */
    copy: (options: OwnCloudMethodOptions & { path: string; destination: string }) => Promise<any>;
    /** Move a file or collection */
    move: (options: OwnCloudMethodOptions & { path: string; destination: string }) => Promise<any>;
    /** Search for files by name pattern */
    searchFiles: (options: OwnCloudMethodOptions & { pattern: string }) => Promise<WebDAVItem[]>;
    /** Get server info */
    getServerInfo: (options?: OwnCloudMethodOptions) => Promise<any>;
    /** Test connection to ownCloud server */
    test: (options?: OwnCloudMethodOptions) => Promise<any>;
  };
};

/**
 * Builds WebDAV request config from ownCloud config and options
 */
function buildWebDAVConfig(
  config: OwnCloudConfig,
  options?: OwnCloudMethodOptions
): WebDAVRequestConfig {
  return {
    baseUrl: config.baseUrl,
    username: config.username,
    password: config.password,
    path: options?.path,
    depth: options?.depth,
    headers: {
      ...config.headers,
      ...options?.headers
    },
    timeout: config.timeout || 30000,
    customProps: options?.customProps
  };
}

/**
 * Wraps an operation with retry logic if enabled
 */
async function withRetryIfEnabled<T>(
  config: OwnCloudConfig,
  operation: () => Promise<T>
): Promise<T> {
  if (config.enableRetry !== false) {
    return withRetry(operation, {
      maxRetries: config.maxRetries || 2,
      baseDelay: 300
    });
  }
  return operation();
}

/**
 * Creates an ownCloud datasource instance
 */
export function createOwnCloudDatasource(config: OwnCloudConfig): OwnCloudDatasourceType {
  // Validate configuration
  if (!config.baseUrl) {
    throw new InvalidConfigError(
      'ownCloud datasource requires a baseUrl',
      'baseUrl',
      'string',
      config.baseUrl
    );
  }
  if (!config.username) {
    throw new InvalidConfigError(
      'ownCloud datasource requires a username',
      'username',
      'string',
      config.username
    );
  }
  if (!config.password) {
    throw new InvalidConfigError(
      'ownCloud datasource requires a password',
      'password',
      'string',
      '***'
    );
  }

  logger.info('Creating ownCloud datasource', {
    baseUrl: config.baseUrl,
    username: config.username,
    webdavRoot: config.webdavRoot || '/remote.php/dav/files'
  });

  return {
    id: config.id || 'owncloud',
    definitionId: 'owncloud',
    config,
    methods: {
      /**
       * Get file content from ownCloud
       */
      getFileContent: async (options: OwnCloudMethodOptions & { path: string }) => {
        return withSpan(`OwnCloud GET ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'getFileContent');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Getting file content', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const content = await getFileContent(webdavConfig, options.asBinary || false);

            if (options.fullResponse) {
              return {
                data: content,
                metadata: {
                  timestamp: Date.now(),
                  source: 'owncloud',
                  path: options.path
                }
              };
            }

            return content;
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Get parsed document with content and metadata
       */
      getDocument: async (options: OwnCloudMethodOptions & { path: string }) => {
        return withSpan(`OwnCloud GET Document ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'getDocument');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Getting and parsing document', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const content = await getFileContent(webdavConfig, true) as ArrayBuffer;

            const parsed = await parseDocument(content, options.path);
            
            logger.info('Document parsed successfully', {
              path: options.path,
              format: parsed.format,
              size: formatBytes(parsed.size || 0),
              wordCount: parsed.content.split(/\s+/).length
            });

            return parsed;
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * List all collections (directories) in the user's root or specified path
       */
      listCollections: async (options?: OwnCloudMethodOptions) => {
        return withSpan(`OwnCloud PROPFIND collections ${options?.path || '/'}`, async (span) => {
          span.setAttribute('owncloud.operation', 'listCollections');
          span.setAttribute('owncloud.path', options?.path || '/');

          logger.debug('Listing collections', { path: options?.path || '/' });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, {
              ...options,
              depth: options?.depth || '1'
            });

            const items = await propfind(webdavConfig);
            const collections = items.filter(item => item.isCollection);

            logger.debug(`Found ${collections.length} collections`);
            return collections;
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * List files in a specific collection
       */
      listFiles: async (options: OwnCloudMethodOptions & { path: string }) => {
        return withSpan(`OwnCloud PROPFIND files ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'listFiles');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Listing files', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, {
              ...options,
              depth: options?.depth || '1'
            });

            const items = await propfind(webdavConfig);

            logger.debug(`Found ${items.length} items`);
            return items;
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * List all items recursively
       */
      listRecursive: async (options?: OwnCloudMethodOptions) => {
        return withSpan(`OwnCloud PROPFIND recursive ${options?.path || '/'}`, async (span) => {
          span.setAttribute('owncloud.operation', 'listRecursive');
          span.setAttribute('owncloud.path', options?.path || '/');

          logger.debug('Listing files recursively', { path: options?.path || '/' });

          const allItems: WebDAVItem[] = [];
          
          const listDirectory = async (path: string) => {
            const webdavConfig = buildWebDAVConfig(config, {
              ...options,
              path,
              depth: '1'
            });

            const items = await propfind(webdavConfig);
            
            for (const item of items) {
              // Skip the parent directory itself
              const itemPath = item.href.split('/remote.php/dav/files/')[1]?.split('/').slice(1).join('/');
              
              if (itemPath && itemPath !== path) {
                allItems.push(item);
                
                if (item.isCollection) {
                  await listDirectory(itemPath);
                }
              }
            }
          };

          await withRetryIfEnabled(config, async () => {
            await listDirectory(options?.path || '');
            return allItems;
          });

          logger.debug(`Found ${allItems.length} items recursively`);
          return allItems;
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Get properties of a specific file
       */
      getFileProperties: async (options: OwnCloudMethodOptions & { path: string }) => {
        return withSpan(`OwnCloud PROPFIND ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'getFileProperties');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Getting file properties', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, {
              ...options,
              depth: '0'
            });

            const items = await propfind(webdavConfig);
            
            if (items.length === 0) {
              throw new NotFoundError(
                `File not found: ${options.path}`,
                'file',
                options.path,
                404
              );
            }

            return items[0];
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Upload a file to ownCloud
       */
      uploadFile: async (options: OwnCloudMethodOptions & { path: string; content: any }) => {
        return withSpan(`OwnCloud PUT ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'uploadFile');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Uploading file', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const response = await putFileContent(webdavConfig, options.content);

            logger.info('File uploaded successfully', { 
              path: options.path,
              status: response.status 
            });

            if (options.fullResponse) {
              return {
                success: true,
                status: response.status,
                statusText: response.statusText,
                metadata: {
                  timestamp: Date.now(),
                  source: 'owncloud',
                  path: options.path
                }
              };
            }

            return { success: true };
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Delete a file or collection
       */
      delete: async (options: OwnCloudMethodOptions & { path: string }) => {
        return withSpan(`OwnCloud DELETE ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'delete');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Deleting resource', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const response = await deleteResource(webdavConfig);

            logger.info('Resource deleted successfully', { 
              path: options.path,
              status: response.status 
            });

            return { success: true, status: response.status };
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Create a new collection (directory)
       */
      createCollection: async (options: OwnCloudMethodOptions & { path: string }) => {
        return withSpan(`OwnCloud MKCOL ${options.path}`, async (span) => {
          span.setAttribute('owncloud.operation', 'createCollection');
          span.setAttribute('owncloud.path', options.path);

          logger.debug('Creating collection', { path: options.path });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const response = await createWebDAVCollection(webdavConfig);

            logger.info('Collection created successfully', { 
              path: options.path,
              status: response.status 
            });

            return { success: true, status: response.status };
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Copy a file or collection
       */
      copy: async (options: OwnCloudMethodOptions & { path: string; destination: string }) => {
        return withSpan(`OwnCloud COPY ${options.path} -> ${options.destination}`, async (span) => {
          span.setAttribute('owncloud.operation', 'copy');
          span.setAttribute('owncloud.path', options.path);
          span.setAttribute('owncloud.destination', options.destination);

          logger.debug('Copying resource', { 
            path: options.path,
            destination: options.destination 
          });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const response = await copyResource(
              webdavConfig,
              options.destination,
              options.overwrite || false
            );

            logger.info('Resource copied successfully', { 
              path: options.path,
              destination: options.destination,
              status: response.status 
            });

            return { success: true, status: response.status };
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Move a file or collection
       */
      move: async (options: OwnCloudMethodOptions & { path: string; destination: string }) => {
        return withSpan(`OwnCloud MOVE ${options.path} -> ${options.destination}`, async (span) => {
          span.setAttribute('owncloud.operation', 'move');
          span.setAttribute('owncloud.path', options.path);
          span.setAttribute('owncloud.destination', options.destination);

          logger.debug('Moving resource', { 
            path: options.path,
            destination: options.destination 
          });

          return withRetryIfEnabled(config, async () => {
            const webdavConfig = buildWebDAVConfig(config, options);
            const response = await moveResource(
              webdavConfig,
              options.destination,
              options.overwrite || false
            );

            logger.info('Resource moved successfully', { 
              path: options.path,
              destination: options.destination,
              status: response.status 
            });

            return { success: true, status: response.status };
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Search for files by name pattern
       */
      searchFiles: async (options: OwnCloudMethodOptions & { pattern: string }) => {
        return withSpan(`OwnCloud SEARCH ${options.pattern}`, async (span) => {
          span.setAttribute('owncloud.operation', 'searchFiles');
          span.setAttribute('owncloud.pattern', options.pattern);

          logger.debug('Searching files', { pattern: options.pattern });

          return withRetryIfEnabled(config, async () => {
            const results: WebDAVItem[] = [];
            const pattern = options.pattern.toLowerCase();

            const searchDirectory = async (path: string) => {
              const webdavConfig = buildWebDAVConfig(config, {
                ...options,
                path,
                depth: '1'
              });

              const items = await propfind(webdavConfig);

              for (const item of items) {
                const itemPath = item.href.split('/remote.php/dav/files/')[1]?.split('/').slice(1).join('/');
                
                if (itemPath && itemPath !== path) {
                  const fileName = itemPath.split('/').pop() || '';
                  
                  if (fileName.toLowerCase().includes(pattern)) {
                    results.push(item);
                  }

                  if (item.isCollection) {
                    await searchDirectory(itemPath);
                  }
                }
              }
            };

            await searchDirectory(options.path || '');

            logger.debug(`Found ${results.length} files matching pattern "${options.pattern}"`);
            return results;
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Get server information
       */
      getServerInfo: async (options?: OwnCloudMethodOptions) => {
        return withSpan('OwnCloud GET Server Info', async (span) => {
          span.setAttribute('owncloud.operation', 'getServerInfo');

          logger.debug('Getting server info');

          return withRetryIfEnabled(config, async () => {
            // Get root properties
            const webdavConfig = buildWebDAVConfig(config, {
              ...options,
              depth: '0'
            });

            const items = await propfind(webdavConfig);

            return {
              baseUrl: config.baseUrl,
              webdavRoot: config.webdavRoot || '/remote.php/dav/files',
              username: config.username,
              connected: items.length > 0,
              timestamp: Date.now()
            };
          });
        }, { kind: SpanKind.CLIENT });
      },

      /**
       * Test connection to ownCloud server
       */
      test: async (options?: OwnCloudMethodOptions) => {
        return withSpan('OwnCloud Test Connection', async (span) => {
          span.setAttribute('owncloud.operation', 'test');
          logger.debug('Testing OwnCloud connection');
          
          return withRetryIfEnabled(config, async () => {
            // Simple test: try to list root directory
            const webdavConfig = buildWebDAVConfig(config, {
              ...options,
              depth: '0'
            });
            
            const items = await propfind(webdavConfig);
            
            return {
              success: true,
              connected: items.length >= 0,
              baseUrl: config.baseUrl,
              username: config.username,
              timestamp: Date.now()
            };
          });
        }, { kind: SpanKind.CLIENT });
      }
    }
  };
}

/**
 * OwnCloud Datasource Definition for registration with DatasourceCatalog
 */
export const OwnCloudDatasource: DatasourceDefinition = {
  id: 'owncloud',
  name: 'OwnCloud WebDAV',
  description: 'WebDAV-based datasource for ownCloud file operations with document parsing support',
  configSchema: {
    type: 'object',
    required: ['baseUrl', 'username', 'password'],
    properties: {
      baseUrl: { 
        type: 'string', 
        description: 'Base URL of the ownCloud instance' 
      },
      username: { 
        type: 'string', 
        description: 'Username for authentication' 
      },
      password: { 
        type: 'string', 
        description: 'Password for authentication' 
      },
      timeout: { 
        type: 'number', 
        description: 'Request timeout in milliseconds (default: 30000)' 
      },
      headers: { 
        type: 'object', 
        description: 'Additional headers to include in requests' 
      },
      webdavRoot: { 
        type: 'string', 
        description: 'WebDAV root path (default: /remote.php/dav/files)' 
      },
      enableRetry: { 
        type: 'boolean', 
        description: 'Whether to enable retry logic (default: true)' 
      },
      maxRetries: { 
        type: 'number', 
        description: 'Maximum number of retries (default: 2)' 
      }
    }
  },
  createInstance: (config: DatasourceConfig) => {
    return createOwnCloudDatasource(config as OwnCloudConfig);
  }
};
