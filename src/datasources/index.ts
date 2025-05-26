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

// Add more datasource exports here as needed
