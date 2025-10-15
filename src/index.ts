/**
 * DataBinder - A TypeScript library to simplify integration with data sources
 * 
 * This library provides utilities for binding and fetching data from various sources,
 * with built-in support for REST APIs, GitHub APIs, and more.
 */

// Export core functionality
export * from './core';

// Export datasource types and implementations
export * as Datasources from './datasources';
export type { DatabaseAdapter, SerializedDatasourceInstance } from './datasources/types';

// Export catalog functionality
export * from './catalog';

// Export validation and sanitization utilities
export * from './utils/validation';
export * from './utils/sanitize';
export * from './utils/logger';
export * from './utils/telemetry';
