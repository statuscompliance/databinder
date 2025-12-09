# OwnCloud WebDAV Datasource

The OwnCloud datasource provides a comprehensive interface for interacting with ownCloud servers using the WebDAV protocol. It includes support for file operations, collections management, and document parsing.

## Features

- **Full WebDAV Support**: Complete implementation of WebDAV operations (GET, PUT, DELETE, PROPFIND, MKCOL, COPY, MOVE)
- **Document Parsing**: Automatic parsing of ODT, DOCX, and other document formats
- **Metadata Extraction**: Extract document metadata including title, author, dates, etc.
- **Retry Logic**: Built-in retry mechanism for handling transient failures
- **Telemetry**: Distributed tracing support with OpenTelemetry
- **Recursive Operations**: List and search files recursively through directory trees
- **Error Handling**: Comprehensive error handling with custom error types

## Installation

The OwnCloud datasource is included in the databinder package. For document parsing features, you'll need to install the optional peer dependency:

```bash
npm install jszip
```

## Configuration

```typescript
import { DatasourceCatalog } from '@statuscompliance/databinder';
import { OwnCloudDatasource } from '@statuscompliance/databinder/datasources';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(OwnCloudDatasource);

const owncloudInstance = catalog.createDatasourceInstance(
  'owncloud',
  {
    baseUrl: 'http://localhost:8080',
    username: 'admin',
    password: 'your-password',
    timeout: 30000,
    enableRetry: true,
    maxRetries: 2,
    webdavRoot: '/remote.php/dav/files' // optional, this is the default
  },
  'my-owncloud'
);
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | string | Yes | - | Base URL of the ownCloud instance |
| `username` | string | Yes | - | Username for authentication |
| `password` | string | Yes | - | Password for authentication |
| `timeout` | number | No | 30000 | Request timeout in milliseconds |
| `headers` | object | No | {} | Additional headers to include in requests |
| `webdavRoot` | string | No | `/remote.php/dav/files` | WebDAV root path |
| `enableRetry` | boolean | No | true | Whether to enable retry logic |
| `maxRetries` | number | No | 2 | Maximum number of retries |

## Usage

### Basic File Operations

```typescript
import { DataBinder, Linker } from '@statuscompliance/databinder';

const linker = new Linker({ datasources: [owncloudInstance] });
const dataBinder = new DataBinder({ linker });

// Get file content
const content = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getFileContent',
  path: 'Documents/Example.odt',
  asBinary: true // optional, returns ArrayBuffer instead of string
});

// Upload a file
await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'uploadFile',
  path: 'Documents/NewFile.txt',
  content: 'Hello, World!'
});

// Delete a file
await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'delete',
  path: 'Documents/OldFile.txt'
});
```

### Document Parsing

```typescript
// Get parsed document with content and metadata
const document = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getDocument',
  path: 'Documents/Example.odt'
});

console.log('Content:', document.content);
console.log('Metadata:', document.metadata);
console.log('Format:', document.format);
console.log('Word count:', document.content.split(/\s+/).length);
```

### Directory Operations

```typescript
// List collections (directories)
const collections = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'listCollections',
  path: '' // root directory
});

// List files in a directory
const files = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'listFiles',
  path: 'Documents',
  depth: '1' // 0 = only resource, 1 = resource + children, infinity = all
});

// List all files recursively
const allFiles = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'listRecursive',
  path: 'Documents'
});

// Create a collection (directory)
await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'createCollection',
  path: 'NewFolder'
});
```

### File Properties

```typescript
// Get file properties
const properties = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getFileProperties',
  path: 'Documents/Example.odt'
});

console.log('Size:', properties.contentLength);
console.log('Type:', properties.contentType);
console.log('Last Modified:', properties.lastModified);
console.log('ETag:', properties.etag);
```

### Copy and Move Operations

```typescript
// Copy a file
await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'copy',
  path: 'Documents/Original.txt',
  destination: 'Backup/Copy.txt',
  overwrite: false // optional, default is false
});

// Move a file
await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'move',
  path: 'Documents/OldLocation.txt',
  destination: 'Documents/NewLocation.txt',
  overwrite: false
});
```

### Search Operations

```typescript
// Search for files by name pattern
const results = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'searchFiles',
  pattern: 'example', // case-insensitive search
  path: '' // optional, defaults to root
});

console.log(`Found ${results.length} files:`);
results.forEach(file => {
  console.log(`- ${file.href} (${file.contentLength} bytes)`);
});
```

### Server Information

```typescript
// Get server information
const serverInfo = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getServerInfo'
});

console.log('Base URL:', serverInfo.baseUrl);
console.log('WebDAV Root:', serverInfo.webdavRoot);
console.log('Connected:', serverInfo.connected);
```

## Advanced Usage

### Custom Headers

```typescript
const content = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getFileContent',
  path: 'Documents/Example.odt',
  headers: {
    'X-Custom-Header': 'value'
  }
});
```

### Full Response

```typescript
const response = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getFileContent',
  path: 'Documents/Example.odt',
  fullResponse: true
});

console.log('Data:', response.data);
console.log('Metadata:', response.metadata);
console.log('Timestamp:', response.metadata.timestamp);
```

### Custom Properties

```typescript
const items = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'listFiles',
  path: 'Documents',
  customProps: ['oc:size', 'oc:permissions']
});
```

## WebDAV Utilities

The package also exports WebDAV utility functions that can be used directly:

```typescript
import {
  buildWebDAVUrl,
  createBasicAuthHeader,
  parseWebDAVResponse,
  formatBytes
} from '@statuscompliance/databinder/datasources';

// Build a WebDAV URL
const url = buildWebDAVUrl('http://localhost:8080', 'admin', 'Documents/file.txt');

// Create Basic Auth header
const authHeader = createBasicAuthHeader('admin', 'password');

// Format bytes
const formatted = formatBytes(1048576); // "1 MB"
```

## Document Utilities

Document parsing and manipulation utilities are also available:

```typescript
import {
  parseDocument,
  detectDocumentFormat,
  extractODFContent,
  extractDOCXContent,
  countWords,
  extractPreview
} from '@statuscompliance/databinder/datasources';

// Detect document format
const format = detectDocumentFormat('example.odt');
console.log('Format:', format.name);
console.log('MIME Type:', format.mimeType);
console.log('Supported:', format.supported);

// Parse document
const parsed = await parseDocument(buffer, 'example.odt');
console.log('Content:', parsed.content);
console.log('Metadata:', parsed.metadata);

// Count words
const wordCount = countWords(text);

// Extract preview
const preview = extractPreview(text, 200);
```

## Supported Document Formats

- **OpenDocument**: ODT, ODS, ODP (requires `jszip`)
- **Microsoft Office**: DOCX, XLSX, PPTX (requires `jszip`)
- **Text**: TXT, MD
- **Others**: PDF detection (parsing not included)

## Error Handling

The OwnCloud datasource uses custom error types from the databinder core:

```typescript
try {
  await dataBinder.fetchFromDatasource('my-owncloud', {
    methodName: 'getFileContent',
    path: 'NonExistent.txt'
  });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('File not found:', error.message);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  } else if (error instanceof InvalidConfigError) {
    console.log('Configuration error:', error.message);
  }
}
```

## Performance Considerations

1. **Retry Logic**: Enable retry logic for production environments to handle transient failures
2. **Timeout**: Adjust timeout based on your network conditions and file sizes
3. **Depth**: Use appropriate depth values for PROPFIND operations (`0`, `1`, or `infinity`)
4. **Binary Mode**: Use `asBinary: true` for binary files to avoid encoding issues
5. **Recursive Operations**: Be cautious with recursive operations on large directory trees

## Best Practices

1. Always handle errors appropriately
2. Use meaningful instance IDs when creating datasources
3. Enable retry logic for production environments
4. Set appropriate timeouts for large file operations
5. Use `getDocument` for automatic parsing of supported formats
6. Implement proper authentication and never hardcode credentials
7. Consider using environment variables for configuration

## Examples

Check out the complete examples in the repository:

- Basic file operations
- Document parsing
- Recursive directory listing
- File search
- Batch operations
- Sync operations

## License

MIT
