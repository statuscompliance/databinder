# REST API Datasource

A generic REST API datasource that can be configured to work with any RESTful API.

## Configuration

```typescript
interface RestApiConfig {
  baseUrl: string;                          // Base URL of the API
  headers?: Record<string, string>;         // Default headers
  timeout?: number;                         // Request timeout in ms
  endpoints?: Record<string, string>;       // Named endpoints
  defaultEndpoint?: string;                 // Default endpoint to use
  auth?: {                                  // Authentication configuration
    type: 'cookie' | 'bearer' | 'basic' | 'custom';
    cookies?: Record<string, string>;
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
    headerValue?: string;
  };
  requestOptions?: RequestInit;             // Additional fetch options
}
```

## Usage Example

```typescript
import { DatasourceCatalog } from '@statuscompliance/databinder';
import { RestApiDatasource } from '@statuscompliance/databinder/datasources';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(RestApiDatasource);

// Create instance with bearer token auth
const restApi = catalog.createDatasourceInstance('rest-api', {
  baseUrl: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  auth: {
    type: 'bearer',
    token: 'your-api-token'
  },
  endpoints: {
    users: '/users',
    posts: '/posts',
    comments: '/comments'
  }
}, 'my-rest-api');

// Use with DataBinder
const dataBinder = new DataBinder({ 
  linker: new Linker({ datasources: [restApi] }) 
});

// Fetch data using different methods
const users = await dataBinder.fetchFromDatasource('my-rest-api', {
  methodName: 'default',
  endpoint: 'users',
  query: {
    filters: { active: true },
    sort: [{ field: 'name', direction: 'asc' }]
  }
});
```

## Available Methods

### default(options)
Performs GET requests to the default endpoint or specified endpoint.

```typescript
const data = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  query: {
    filters: { role: 'admin' },
    sort: [{ field: 'created_at', direction: 'desc' }]
  },
  pagination: {
    enabled: true,
    pageSize: 50,
    startPage: 1
  }
});
```

### getById(options)
Fetches a specific resource by ID.

```typescript
const user = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'getById',
  id: '123',
  endpoint: '/users' // optional base endpoint
});
```

### search(options)
Performs search operations.

```typescript
const results = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'search',
  query: {
    filters: { name: 'John' }
  }
});
```

## HTTP Methods

You can specify the HTTP method in the options:

```typescript
// POST request
const newUser = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  method: 'POST',
  endpoint: '/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});

// PUT request
const updatedUser = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  method: 'PUT',
  endpoint: '/users/123',
  body: { name: 'Jane Doe' }
});

// PATCH request
const patchedUser = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  method: 'PATCH',
  endpoint: '/users/123',
  body: { email: 'jane@example.com' }
});

// DELETE request
await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  method: 'DELETE',
  endpoint: '/users/123'
});
```

## Authentication Types

### Bearer Token
```typescript
auth: {
  type: 'bearer',
  token: 'your-jwt-token'
}
```

### Basic Authentication
```typescript
auth: {
  type: 'basic',
  username: 'user',
  password: 'pass'
}
```

### Cookie Authentication
```typescript
auth: {
  type: 'cookie',
  cookies: {
    'session_id': 'abc123',
    'csrf_token': 'xyz789'
  }
}
```

### Custom Header
```typescript
auth: {
  type: 'custom',
  headerName: 'X-API-Key',
  headerValue: 'your-api-key'
}
```

## Advanced Features

### Retry Logic
Configure retry behavior for failed requests:

```typescript
const data = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  retryOptions: {
    maxRetries: 3,
    baseDelay: 1000,
    exponential: true
  }
});
```

### Response Formats

```typescript
// Full response with metadata
const response = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  responseOptions: {
    fullResponse: true
  }
});
// Returns: { status, statusText, headers, data, ok }

// Batch response
const batchResponse = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  responseFormat: 'batch'
});
// Returns: { data: [], metadata: { totalItems, currentPage, hasNextPage, ... } }

// Stream response
const streamResponse = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/large-file',
  responseFormat: 'stream'
});
// Returns: { stream: ReadableStream, metadata: { ... } }
```

### Custom Headers per Request

```typescript
const data = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  headers: {
    'X-Custom-Header': 'value',
    'X-Request-ID': 'abc123'
  }
});
```

### Authentication Override

```typescript
const data = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  authOverride: {
    type: 'bearer',
    token: 'different-token-for-this-request'
  }
});
```

## Error Handling

The REST API datasource throws specific error types:

```typescript
import { 
  NetworkError, 
  AuthenticationError, 
  NotFoundError, 
  TimeoutError 
} from '@statuscompliance/databinder/core/errors';

try {
  await dataBinder.fetchFromDatasource('rest-api-id', {
    methodName: 'default',
    endpoint: '/users'
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Authentication failed:', error.message);
  } else if (error instanceof NotFoundError) {
    console.log('Resource not found:', error.message);
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out:', error.message);
  } else if (error instanceof NetworkError) {
    console.log('Network error:', error.message);
  }
}
```

## Creating Custom REST API Datasources

You can create specialized REST API datasources using the `createRestApiBasedDatasource` utility:

```typescript
import { createRestApiBasedDatasource } from '@statuscompliance/databinder/datasources';

const MyApiDatasource = createRestApiBasedDatasource(
  'my-api',
  'My Custom API',
  'A specialized datasource for my API',
  {
    baseUrl: 'https://api.myservice.com',
    auth: { type: 'bearer' }
  },
  {
    // Custom methods
    getWidgets: async (options) => {
      // Implementation
    },
    createWidget: async (options) => {
      // Implementation
    }
  }
);

catalog.registerDatasource(MyApiDatasource);
```

## Best Practices

1. **Use named endpoints** for better maintainability
2. **Configure appropriate timeouts** based on your API's response times
3. **Enable retry logic** for production environments
4. **Use authentication overrides** when needed for different permissions
5. **Handle errors gracefully** with proper error types
6. **Set reasonable page sizes** for pagination
7. **Use request IDs** for tracking and debugging

## Examples

### Pagination Example
```typescript
let page = 1;
let hasMore = true;
const allUsers = [];

while (hasMore) {
  const response = await dataBinder.fetchFromDatasource('rest-api-id', {
    methodName: 'default',
    endpoint: '/users',
    pagination: {
      enabled: true,
      pageSize: 100,
      startPage: page
    },
    responseFormat: 'batch'
  });
  
  allUsers.push(...response.data);
  hasMore = response.metadata.hasNextPage;
  page++;
}
```

### Complex Query Example
```typescript
const data = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'default',
  endpoint: '/users',
  query: {
    filters: {
      status: 'active',
      role: ['admin', 'moderator'],
      created_after: '2024-01-01'
    },
    sort: [
      { field: 'last_login', direction: 'desc' },
      { field: 'username', direction: 'asc' }
    ]
  }
});
```
