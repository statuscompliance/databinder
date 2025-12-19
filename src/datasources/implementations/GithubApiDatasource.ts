/**
 * GitHub API Datasource Implementation
 * 
 * Provides a specialized datasource for interacting with the GitHub REST API,
 * with pre-configured methods for common GitHub operations.
 */
import { Datasource, DatasourceConfig, DatasourceDefinition } from '../types';
import {
  RestApiConfig,
  RestApiMethodOptions,
  createRestApiBasedDatasource,
  fetchData
} from './RestApiDatasource';

/**
 * GitHub API specific configuration options
 */
export interface GithubApiConfig extends RestApiConfig {
  /**
   * Personal Access Token for GitHub API
   */
  personalAccessToken?: string;
  
  /**
   * Default organization for API calls
   */
  defaultOrg?: string;
  
  /**
   * Default repository for API calls
   */
  defaultRepo?: string;
  
  /**
   * API version to use (defaults to 'v3')
   */
  apiVersion?: string;
}

/**
 * GitHub API specific method options
 */
export interface GithubApiMethodOptions extends RestApiMethodOptions {
  /**
   * Configuration for GitHub API datasource
   */
  config?: GithubApiConfig;
  
  /**
   * Repository owner (user or organization)
   */
  owner?: string;
  
  /**
   * Repository name
   */
  repo?: string;
  
  /**
   * Issue number
   */
  issueNumber?: number;
  
  /**
   * Pull request number
   */
  pullNumber?: number;
  
  /**
   * GitHub API specific state filter ('open', 'closed', 'all')
   */
  state?: 'open' | 'closed' | 'all';
  
  /**
   * GitHub API specific sort options
   */
  sort?: 'created' | 'updated' | 'comments';
  
  /**
   * GitHub API specific direction ('asc' or 'desc')
   */
  direction?: 'asc' | 'desc';
  
  /**
   * GitHub API specific label filter
   */
  labels?: string[];
}

/**
 * Type definition for GitHub API datasource
 */
export type GithubApiDatasourceType = Datasource & {
  config: GithubApiConfig;
  methods: {
    // Standard methods
    default: (options?: GithubApiMethodOptions) => Promise<any>;
    getById: (options?: GithubApiMethodOptions & { id: string }) => Promise<any>;
    search: (options?: GithubApiMethodOptions) => Promise<any>;
    
    // GitHub specific methods
    getRepositories: (options?: GithubApiMethodOptions) => Promise<any>;
    getRepository: (options?: GithubApiMethodOptions) => Promise<any>;
    getIssues: (options?: GithubApiMethodOptions) => Promise<any>;
    getIssue: (options?: GithubApiMethodOptions) => Promise<any>;
    getPullRequests: (options?: GithubApiMethodOptions) => Promise<any>;
    getPullRequest: (options?: GithubApiMethodOptions) => Promise<any>;
    getContents: (options?: GithubApiMethodOptions & { path: string }) => Promise<any>;
    searchCode: (options?: GithubApiMethodOptions & { query: string }) => Promise<any>;
    searchIssues: (options?: GithubApiMethodOptions & { query: string }) => Promise<any>;
    getUser: (options?: GithubApiMethodOptions & { username?: string }) => Promise<any>;
    
    // Allow additional methods
    [key: string]: (options?: any) => Promise<any>;
  };
};

/**
 * Methods for the GitHub API datasource
 * Each method handles a specific GitHub API operation
 */
const githubApiMethods = {
  // Repository methods
  /**
   * Get repositories for the authenticated user or for a specific organization
   * 
   * @param options - GitHub API method options
   * @returns Promise with repositories data
   */
  getRepositories: async (options?: GithubApiMethodOptions) => {
    const config = options?.config as GithubApiConfig;
    const org = options?.owner || config?.defaultOrg;
    
    let endpoint = '/user/repos';
    if (org) {
      endpoint = `/orgs/${org}/repos`;
    }
    
    return fetchData(config, endpoint, options);
  },
  
  /**
   * Get a specific repository by owner and name
   * 
   * @param options - GitHub API method options
   * @returns Promise with repository data
   * @throws Error if owner or repo is not provided
   */
  getRepository: async (options?: GithubApiMethodOptions) => {
    const config = options?.config as GithubApiConfig;
    const owner = options?.owner || config?.defaultOrg;
    const repo = options?.repo || config?.defaultRepo;
    
    if (!owner || !repo) {
      throw new Error('getRepository method requires owner and repo parameters');
    }
    
    return fetchData(config, `/repos/${owner}/${repo}`, options);
  },
  
  // Issue methods
  /**
   * Get issues for a specific repository
   * 
   * @param options - GitHub API method options
   * @returns Promise with issues data
   * @throws Error if owner or repo is not provided
   */
  getIssues: async (options?: GithubApiMethodOptions) => {
    const config = options?.config as GithubApiConfig;
    const owner = options?.owner || config?.defaultOrg;
    const repo = options?.repo || config?.defaultRepo;
    
    if (!owner || !repo) {
      throw new Error('getIssues method requires owner and repo parameters');
    }
    
    let url = `/repos/${owner}/${repo}/issues`;
    
    // Add query parameters
    const urlObj = new URL(url, 'https://api.github.com');
    
    if (options?.state) {
      urlObj.searchParams.append('state', options.state);
    }
    
    if (options?.sort) {
      urlObj.searchParams.append('sort', options.sort);
    }
    
    if (options?.direction) {
      urlObj.searchParams.append('direction', options.direction);
    }
    
    if (options?.labels && options.labels.length > 0) {
      urlObj.searchParams.append('labels', options.labels.join(','));
    }
    
    return fetchData(config, urlObj.pathname + urlObj.search, options);
  },
  
  /**
   * Get a specific issue by number
   * 
   * @param options - GitHub API method options
   * @returns Promise with issue data
   * @throws Error if owner, repo, or issueNumber is not provided
   */
  getIssue: async (options?: GithubApiMethodOptions) => {
    const config = options?.config as GithubApiConfig;
    const owner = options?.owner || config?.defaultOrg;
    const repo = options?.repo || config?.defaultRepo;
    const issueNumber = options?.issueNumber;
    
    if (!owner || !repo || !issueNumber) {
      throw new Error('getIssue method requires owner, repo, and issueNumber parameters');
    }
    
    return fetchData(config, `/repos/${owner}/${repo}/issues/${issueNumber}`, options);
  },
  
  // Pull request methods
  getPullRequests: async (options?: GithubApiMethodOptions) => {
    const config = options?.config as GithubApiConfig;
    const owner = options?.owner || config?.defaultOrg;
    const repo = options?.repo || config?.defaultRepo;
    
    if (!owner || !repo) {
      throw new Error('getPullRequests method requires owner and repo parameters');
    }
    
    let url = `/repos/${owner}/${repo}/pulls`;
    
    // Add query parameters
    const urlObj = new URL(url, 'https://api.github.com');
    
    if (options?.state) {
      urlObj.searchParams.append('state', options.state);
    }
    
    if (options?.sort) {
      urlObj.searchParams.append('sort', options.sort);
    }
    
    if (options?.direction) {
      urlObj.searchParams.append('direction', options.direction);
    }
    
    return fetchData(config, urlObj.pathname + urlObj.search, options);
  },
  
  getPullRequest: async (options?: GithubApiMethodOptions) => {
    const config = options?.config as GithubApiConfig;
    const owner = options?.owner || config?.defaultOrg;
    const repo = options?.repo || config?.defaultRepo;
    const pullNumber = options?.pullNumber;
    
    if (!owner || !repo || !pullNumber) {
      throw new Error('getPullRequest method requires owner, repo, and pullNumber parameters');
    }
    
    return fetchData(config, `/repos/${owner}/${repo}/pulls/${pullNumber}`, options);
  },
  
  // Content methods
  getContents: async (options?: GithubApiMethodOptions & { path: string }) => {
    const config = options?.config as GithubApiConfig;
    const owner = options?.owner || config?.defaultOrg;
    const repo = options?.repo || config?.defaultRepo;
    const path = options?.path;
    
    if (!owner || !repo || !path) {
      throw new Error('getContents method requires owner, repo, and path parameters');
    }
    
    return fetchData(config, `/repos/${owner}/${repo}/contents/${path}`, options);
  },
  
  // Search methods
  searchCode: async (options?: GithubApiMethodOptions & { query: string }) => {
    const config = options?.config as GithubApiConfig;
    const query = options?.query;
    
    if (!query) {
      throw new Error('searchCode method requires a query parameter');
    }
    
    const urlObj = new URL('/search/code', 'https://api.github.com');
    urlObj.searchParams.append('q', query);
    
    return fetchData(config, urlObj.pathname + urlObj.search, options);
  },
  
  searchIssues: async (options?: GithubApiMethodOptions & { query: string }) => {
    const config = options?.config as GithubApiConfig;
    const query = options?.query;
    
    if (!query) {
      throw new Error('searchIssues method requires a query parameter');
    }
    
    const urlObj = new URL('/search/issues', 'https://api.github.com');
    urlObj.searchParams.append('q', query);
    
    return fetchData(config, urlObj.pathname + urlObj.search, options);
  },
  
  // User methods
  getUser: async (options?: GithubApiMethodOptions & { username?: string }) => {
    const config = options?.config as GithubApiConfig;
    const username = options?.username;
    
    let endpoint = '/user';
    if (username) {
      endpoint = `/users/${username}`;
    }
    
    return fetchData(config, endpoint, options);
  }
};

/**
 * Create a GitHub API datasource instance
 * 
 * @param config - Configuration for the GitHub API datasource
 * @returns A GitHub API datasource instance
 */
export function createGithubApiDatasource(config: GithubApiConfig): GithubApiDatasourceType {
  // Apply default API version if not specified
  const apiVersion = config.apiVersion || 'v3';
  
  // Configure authentication if personalAccessToken is provided
  if (config.personalAccessToken && !config.auth) {
    config.auth = {
      type: 'bearer',
      token: config.personalAccessToken
    };
  }
  
  // Apply default headers
  const headers = {
    'Accept': `application/vnd.github.${apiVersion}+json`,
    'User-Agent': 'DataBinder-GithubAPI',
    ...(config.headers || {})
  };
  
  // Create the datasource with merged configuration
  const mergedConfig: GithubApiConfig = {
    ...config,
    headers,
    baseUrl: config.baseUrl || 'https://api.github.com'
  };
  
  // Create a base REST API datasource instance
  const baseInstance = createRestApiBasedDatasource(
    config.id || 'github-instance', // Use the config ID or a default value
    'GitHub API Instance',
    'Instance of GitHub API datasource',
    mergedConfig,
    {}
  ).createInstance(mergedConfig);
  
  // Ensure the instance has the correct type and ID
  const instance = baseInstance as GithubApiDatasourceType;
  instance.id = config.id || 'github-instance'; // Ensure the ID is set
  
  // Add GitHub-specific methods
  Object.entries(githubApiMethods).forEach(([key, method]) => {
    instance.methods[key] = (options?: any) => {
      return method({
        ...options,
        config: mergedConfig
      });
    };
  });
  
  // Add introspection utility methods
  instance.listMethods = function() {
    return Object.keys(this.methods);
  };
  
  instance.getMethodInfo = function(methodName: string) {
    return this.methodsMetadata?.[methodName];
  };
  
  instance.getAllMethodsInfo = function() {
    return this.methodsMetadata || {};
  };
  
  return instance;
}

/**
 * Helper function to create a datasource definition for GitHub API
 */
export const GithubApiDatasource: DatasourceDefinition = {
  id: 'github-api',
  name: 'GitHub API Datasource',
  description: 'REST API datasource for GitHub API with support for repositories, issues, pull requests, and more',
  configSchema: {
    type: 'object',
    required: ['baseUrl'],
    properties: {
      baseUrl: { type: 'string' },
      personalAccessToken: { type: 'string' },
      defaultOrg: { type: 'string' },
      defaultRepo: { type: 'string' },
      apiVersion: { type: 'string' },
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
    // Using createRestApiBasedDatasource directly instead of calling createGithubApiDatasource
    // to avoid recursion
    const mergedConfig = config as GithubApiConfig;
    
    // Create a REST API instance first
    const baseInstance = createRestApiBasedDatasource(
      'github-instance',
      'GitHub API Instance',
      'Instance of GitHub API datasource',
      mergedConfig,
      {}
    ).createInstance(mergedConfig);
    
    // Ensure the instance has the correct type
    const instance = baseInstance as GithubApiDatasourceType;
    
    // Add GitHub-specific methods
    Object.entries(githubApiMethods).forEach(([key, method]) => {
      instance.methods[key] = (options?: any) => {
        return method({
          ...options,
          config: mergedConfig
        });
      };
    });
    
    return instance;
  }
};
