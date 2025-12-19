/**
 * WebDAV Utilities
 * 
 * Provides utility functions for working with WebDAV protocols and operations.
 * This includes XML parsing, URL building, and WebDAV-specific request handling.
 */

import { logger } from '../core/logger';
import { NetworkError, InvalidConfigError } from '../core/errors';
import { sanitizeString, sanitizeUrl } from './sanitize';

/**
 * WebDAV response item representing a file or collection
 */
export interface WebDAVItem {
  /** WebDAV href (path) */
  href: string;
  /** Whether this is a collection (directory) */
  isCollection: boolean;
  /** Last modified date */
  lastModified?: string;
  /** Content length in bytes */
  contentLength?: number;
  /** Content type (MIME type) */
  contentType?: string;
  /** ETag for the resource */
  etag?: string;
  /** Display name */
  displayName?: string;
  /** Creation date */
  creationDate?: string;
  /** Additional properties */
  [key: string]: any;
}

/**
 * WebDAV request configuration
 */
export interface WebDAVRequestConfig {
  /** Base URL of the WebDAV server */
  baseUrl: string;
  /** Username for authentication */
  username: string;
  /** Password for authentication */
  password: string;
  /** Path to the resource */
  path?: string;
  /** Depth header value */
  depth?: '0' | '1' | 'infinity';
  /** Additional headers */
  headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom properties to request in PROPFIND */
  customProps?: string[];
}

/**
 * Creates Basic Authentication header value
 * 
 * @param username - Username for authentication
 * @param password - Password for authentication
 * @returns Base64 encoded Basic Auth header value
 */
export function createBasicAuthHeader(username: string, password: string): string {
  if (!username || !password) {
    throw new InvalidConfigError(
      'Username and password are required for Basic Auth',
      'auth',
      'object',
      { username, password }
    );
  }
  
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Builds a WebDAV URL for a given path
 * 
 * @param baseUrl - Base URL of the WebDAV server
 * @param username - Username (used in some WebDAV URL schemes)
 * @param path - Path to the resource
 * @param webdavRoot - WebDAV root path (default: /remote.php/dav/files)
 * @returns Complete WebDAV URL
 */
export function buildWebDAVUrl(
  baseUrl: string,
  username: string,
  path?: string,
  webdavRoot: string = '/remote.php/dav/files'
): string {
  const safeBaseUrl = sanitizeUrl(baseUrl);
  if (!safeBaseUrl) {
    throw new InvalidConfigError(
      'Invalid WebDAV base URL',
      'baseUrl',
      'url',
      baseUrl
    );
  }

  const cleanBaseUrl = safeBaseUrl.replace(/\/$/, '');
  const safePath = path ? sanitizeString(path) : '';
  const cleanPath = safePath ? `/${safePath.replace(/^\//, '')}` : '';
  const safeUsername = sanitizeString(username);

  return `${cleanBaseUrl}${webdavRoot}/${safeUsername}${cleanPath}`;
}

/**
 * Generates a PROPFIND XML request body
 * 
 * @param customProps - Optional custom properties to request
 * @returns XML string for PROPFIND request
 */
export function generatePropfindXml(customProps?: string[]): string {
  const standardProps = [
    'd:getlastmodified',
    'd:getcontentlength',
    'd:getcontenttype',
    'd:getetag',
    'd:creationdate',
    'd:displayname',
    'd:resourcetype'
  ];

  const allProps = customProps 
    ? [...standardProps, ...customProps.map(p => sanitizeString(p))]
    : standardProps;

  const propsXml = allProps.map(prop => `<${prop}/>`).join('\n      ');

  return `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
      ${propsXml}
  </d:prop>
</d:propfind>`;
}

/**
 * Parses a WebDAV XML response into structured data
 * 
 * @param xmlText - Raw XML response text
 * @returns Array of parsed WebDAV items
 */
export function parseWebDAVResponse(xmlText: string): WebDAVItem[] {
  const items: WebDAVItem[] = [];
  
  try {
    // Match all <d:response> elements
    const responseRegex = /<d:response[^>]*>([\s\S]*?)<\/d:response>/g;
    let match;

    while ((match = responseRegex.exec(xmlText)) !== null) {
      const responseContent = match[1];
      
      // Extract href
      const hrefMatch = /<d:href[^>]*>(.*?)<\/d:href>/.exec(responseContent);
      const href = hrefMatch ? decodeURIComponent(hrefMatch[1]) : '';
      
      // Check if it's a collection by looking for resourcetype
      const isCollection = /<d:collection\s*\/>|<d:collection>/.test(responseContent);
      
      // Extract standard properties
      const lastModifiedMatch = /<d:getlastmodified[^>]*>(.*?)<\/d:getlastmodified>/.exec(responseContent);
      const contentLengthMatch = /<d:getcontentlength[^>]*>(.*?)<\/d:getcontentlength>/.exec(responseContent);
      const contentTypeMatch = /<d:getcontenttype[^>]*>(.*?)<\/d:getcontenttype>/.exec(responseContent);
      const etagMatch = /<d:getetag[^>]*>(.*?)<\/d:getetag>/.exec(responseContent);
      const displayNameMatch = /<d:displayname[^>]*>(.*?)<\/d:displayname>/.exec(responseContent);
      const creationDateMatch = /<d:creationdate[^>]*>(.*?)<\/d:creationdate>/.exec(responseContent);
      
      const item: WebDAVItem = {
        href,
        isCollection,
        lastModified: lastModifiedMatch ? lastModifiedMatch[1] : undefined,
        contentLength: contentLengthMatch ? parseInt(contentLengthMatch[1], 10) : undefined,
        contentType: contentTypeMatch ? contentTypeMatch[1] : undefined,
        etag: etagMatch ? etagMatch[1].replace(/&quot;|"/g, '') : undefined,
        displayName: displayNameMatch ? displayNameMatch[1] : undefined,
        creationDate: creationDateMatch ? creationDateMatch[1] : undefined,
      };
      
      items.push(item);
    }
    
    logger.debug(`Parsed ${items.length} items from WebDAV response`);
    return items;
    
  } catch (error) {
    logger.error('Failed to parse WebDAV XML response', { error });
    throw new NetworkError(
      `Failed to parse WebDAV response: ${error instanceof Error ? error.message : String(error)}`,
      'webdav',
      'PROPFIND'
    );
  }
}

/**
 * Makes a WebDAV request with proper headers and error handling
 * 
 * @param config - WebDAV request configuration
 * @param method - HTTP method to use
 * @param body - Optional request body
 * @returns Response object
 */
export async function makeWebDAVRequest(
  config: WebDAVRequestConfig,
  method: string,
  body?: string | ArrayBuffer | Buffer | BodyInit
): Promise<Response> {
  const url = buildWebDAVUrl(config.baseUrl, config.username, config.path);
  
  const headers: Record<string, string> = {
    'Authorization': createBasicAuthHeader(config.username, config.password),
    ...config.headers,
  };

  // Add depth header for PROPFIND requests
  if (config.depth !== undefined && method === 'PROPFIND') {
    headers['Depth'] = config.depth;
  }

  // Add content type for PROPFIND with XML body
  if (method === 'PROPFIND' && body) {
    headers['Content-Type'] = 'application/xml; charset=utf-8';
  }

  // Convert body to string for consistent handling across environments
  let bodyInit: string | undefined = undefined;
  if (body) {
    if (body instanceof Buffer) {
      bodyInit = body.toString();
    } else if (body instanceof ArrayBuffer) {
      bodyInit = new TextDecoder().decode(body);
    } else {
      bodyInit = body as string;
    }
  }

  const requestInit: RequestInit = {
    method,
    headers,
    body: bodyInit,
    signal: config.timeout ? AbortSignal.timeout(config.timeout) : undefined,
  };

  try {
    logger.debug(`Making WebDAV ${method} request`, { url, depth: config.depth });
    
    const response = await fetch(url, requestInit);

    if (!response.ok) {
      throw new NetworkError(
        `WebDAV request failed: ${response.status} ${response.statusText}`,
        url,
        method,
        response.status
      );
    }

    return response;
    
  } catch (error) {
    if (error instanceof NetworkError) {
      throw error;
    }
    
    logger.error('WebDAV request error', { error, url, method });
    throw new NetworkError(
      `WebDAV request error: ${error instanceof Error ? error.message : String(error)}`,
      url,
      method
    );
  }
}

/**
 * Gets file or collection properties using PROPFIND
 * 
 * @param config - WebDAV request configuration
 * @returns Array of WebDAV items
 */
export async function propfind(config: WebDAVRequestConfig): Promise<WebDAVItem[]> {
  const body = generatePropfindXml(config.customProps);
  const response = await makeWebDAVRequest(config, 'PROPFIND', body);
  const xmlText = await response.text();
  return parseWebDAVResponse(xmlText);
}

/**
 * Gets file content from WebDAV server
 * 
 * @param config - WebDAV request configuration
 * @param asBinary - Whether to return content as ArrayBuffer
 * @returns File content
 */
export async function getFileContent(
  config: WebDAVRequestConfig,
  asBinary: boolean = false
): Promise<string | ArrayBuffer> {
  const response = await makeWebDAVRequest(config, 'GET');
  
  if (asBinary) {
    return await response.arrayBuffer();
  }
  
  return await response.text();
}

/**
 * Uploads file content to WebDAV server
 * 
 * @param config - WebDAV request configuration
 * @param content - File content to upload
 * @returns Response from server
 */
export async function putFileContent(
  config: WebDAVRequestConfig,
  content: string | ArrayBuffer | Buffer
): Promise<Response> {
  return await makeWebDAVRequest(config, 'PUT', content);
}

/**
 * Deletes a file or collection from WebDAV server
 * 
 * @param config - WebDAV request configuration
 * @returns Response from server
 */
export async function deleteResource(config: WebDAVRequestConfig): Promise<Response> {
  return await makeWebDAVRequest(config, 'DELETE');
}

/**
 * Creates a collection (directory) on WebDAV server
 * 
 * @param config - WebDAV request configuration
 * @returns Response from server
 */
export async function createCollection(config: WebDAVRequestConfig): Promise<Response> {
  return await makeWebDAVRequest(config, 'MKCOL');
}

/**
 * Copies a resource on WebDAV server
 * 
 * @param config - WebDAV request configuration
 * @param destination - Destination path
 * @param overwrite - Whether to overwrite existing resource
 * @returns Response from server
 */
export async function copyResource(
  config: WebDAVRequestConfig,
  destination: string,
  overwrite: boolean = false
): Promise<Response> {
  const destUrl = buildWebDAVUrl(config.baseUrl, config.username, destination);
  
  const headers = {
    ...config.headers,
    'Destination': destUrl,
    'Overwrite': overwrite ? 'T' : 'F'
  };

  return await makeWebDAVRequest(
    { ...config, headers },
    'COPY'
  );
}

/**
 * Moves a resource on WebDAV server
 * 
 * @param config - WebDAV request configuration
 * @param destination - Destination path
 * @param overwrite - Whether to overwrite existing resource
 * @returns Response from server
 */
export async function moveResource(
  config: WebDAVRequestConfig,
  destination: string,
  overwrite: boolean = false
): Promise<Response> {
  const destUrl = buildWebDAVUrl(config.baseUrl, config.username, destination);
  
  const headers = {
    ...config.headers,
    'Destination': destUrl,
    'Overwrite': overwrite ? 'T' : 'F'
  };

  return await makeWebDAVRequest(
    { ...config, headers },
    'MOVE'
  );
}

/**
 * Formats bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
