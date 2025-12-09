/**
 * Exports all datasource types, interfaces, and implementations
 */

// Export base datasource types
export * from './types';

// Export REST API datasource and utilities
export {
  RestApiDatasource,
  RestApiConfig,
  RestApiMethodOptions,
  RestApiDatasourceType,
  createRestApiDatasource,
  createRestApiBasedDatasource,
  fetchData as fetchRestApiData
} from './implementations/RestApiDatasource';

// Export GitHub API datasource
export {
  GithubApiDatasource,
  GithubApiConfig,
  GithubApiMethodOptions,
  GithubApiDatasourceType,
  createGithubApiDatasource
} from './implementations/GithubApiDatasource';

// Export Microsoft Graph datasource
export {
  MicrosoftGraphDatasource,
  MicrosoftGraphConfig,
  MicrosoftGraphOptions,
  createMicrosoftGraphDatasource
} from './implementations/MicrosoftGraphDatasource';

// Export OwnCloud datasource
export {
  OwnCloudDatasource,
  OwnCloudConfig,
  OwnCloudMethodOptions,
  OwnCloudDatasourceType,
  createOwnCloudDatasource
} from './implementations/OwnCloudDatasource';

// Export utility modules
export * from '../utils/retryUtils';
export * from '../utils/webdavUtils';
export * from '../utils/documentUtils';

// Add more datasource exports here as needed
