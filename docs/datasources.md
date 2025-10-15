# Built-in Datasources

DataBinder comes with several built-in datasource implementations for common APIs and services.

## RestApiDatasource

A generic REST API datasource that can be configured to work with any RESTful API.

### Configuration

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

### Usage Example

```typescript
import { DatasourceCatalog } from '@statuscompliance/databinder';
import { RestApiDatasource } from '@statuscompliance/databinder/Datasources';

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
  methodName: 'get',
  endpoint: 'users',
  query: {
    filters: { active: true },
    sort: [{ field: 'name', direction: 'asc' }]
  }
});
```

### Available Methods

#### get(options)
Performs GET requests to fetch data.

```typescript
const data = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'get',
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

#### post(options)
Performs POST requests to create resources.

```typescript
const newUser = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'post',
  endpoint: '/users',
  body: {
    name: 'John Doe',
    email: 'john@example.com'
  }
});
```

#### put(options) / patch(options)
Performs PUT/PATCH requests to update resources.

```typescript
const updatedUser = await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'patch',
  endpoint: '/users/123',
  body: { name: 'Jane Doe' }
});
```

#### delete(options)
Performs DELETE requests to remove resources.

```typescript
await dataBinder.fetchFromDatasource('rest-api-id', {
  methodName: 'delete',
  endpoint: '/users/123'
});
```

### Authentication Types

#### Bearer Token
```typescript
auth: {
  type: 'bearer',
  token: 'your-jwt-token'
}
```

#### Basic Authentication
```typescript
auth: {
  type: 'basic',
  username: 'user',
  password: 'pass'
}
```

#### Cookie Authentication
```typescript
auth: {
  type: 'cookie',
  cookies: {
    'session_id': 'abc123',
    'csrf_token': 'xyz789'
  }
}
```

#### Custom Header
```typescript
auth: {
  type: 'custom',
  headerName: 'X-API-Key',
  headerValue: 'your-api-key'
}
```

## GithubApiDatasource

A specialized datasource for the GitHub REST API with pre-configured methods for common GitHub operations.

### Configuration

```typescript
interface GithubApiConfig extends RestApiConfig {
  personalAccessToken?: string;    // GitHub Personal Access Token
  defaultOrg?: string;            // Default organization
  defaultRepo?: string;           // Default repository
  apiVersion?: string;            // API version (defaults to 'v3')
}
```

### Usage Example

```typescript
import { GithubApiDatasource } from '@statuscompliance/databinder/Datasources';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(GithubApiDatasource);

const githubApi = catalog.createDatasourceInstance('github-api', {
  personalAccessToken: 'ghp_xxxxxxxxxxxx',
  defaultOrg: 'octocat',
  apiVersion: 'v3'
}, 'github-instance');
```

### Available Methods

#### getUser(options)
Fetches user information.

```typescript
const user = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getUser',
  username: 'octocat'  // Optional, uses authenticated user if not provided
});
```

#### getRepository(options)
Fetches repository information.

```typescript
const repo = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getRepository',
  owner: 'octocat',
  repo: 'Hello-World'
});
```

#### getRepositories(options)
Fetches repositories for a user or organization.

```typescript
const repos = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getRepositories',
  owner: 'octocat',
  type: 'public',  // 'public', 'private', 'all'
  sort: 'updated',
  pagination: {
    enabled: true,
    pageSize: 30
  }
});
```

#### getIssues(options)
Fetches issues from a repository.

```typescript
const issues = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getIssues',
  owner: 'octocat',
  repo: 'Hello-World',
  state: 'open',  // 'open', 'closed', 'all'
  labels: ['bug', 'help wanted']
});
```

#### getPullRequests(options)
Fetches pull requests from a repository.

```typescript
const prs = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getPullRequests',
  owner: 'octocat',
  repo: 'Hello-World',
  state: 'open',
  sort: 'updated'
});
```

#### getCommits(options)
Fetches commits from a repository.

```typescript
const commits = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getCommits',
  owner: 'octocat',
  repo: 'Hello-World',
  branch: 'main',
  since: '2024-01-01T00:00:00Z'
});
```

## MicrosoftGraphDatasource

A datasource for Microsoft Graph API to access Microsoft 365 services.

### Configuration

```typescript
interface MicrosoftGraphConfig extends DatasourceConfig {
  tenantId?: string;              // Azure AD tenant ID
  clientId?: string;              // Application client ID
  clientSecret?: string;          // Application client secret
  scopes?: string[];             // OAuth scopes
  accessToken?: string;          // Direct access token
  apiVersion?: string;           // API version (defaults to 'v1.0')
}
```

### Usage Example

```typescript
import { MicrosoftGraphDatasource } from '@statuscompliance/databinder/Datasources';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(MicrosoftGraphDatasource);

const graphApi = catalog.createDatasourceInstance('microsoft-graph', {
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scopes: ['https://graph.microsoft.com/.default']
}, 'graph-instance');
```

### Available Methods

#### getUsers(options)
Fetches users from Azure AD.

```typescript
const users = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'getUsers',
  filter: "startswith(displayName,'John')",
  select: ['id', 'displayName', 'mail']
});
```

#### getUser(options)
Fetches a specific user.

```typescript
const user = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'getUser',
  userId: 'user@domain.com'
});
```

#### getGroups(options)
Fetches Azure AD groups.

```typescript
const groups = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'getGroups',
  filter: "groupTypes/any(c:c eq 'Unified')"  // Office 365 groups only
});
```

#### getMessages(options)
Fetches messages from a user's mailbox.

```typescript
const messages = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'getMessages',
  userId: 'user@domain.com',
  folder: 'inbox',
  filter: "isRead eq false"
});
```

## Common Features

All built-in datasources support:

### Pagination
```typescript
{
  pagination: {
    enabled: true,
    pageSize: 50,
    startPage: 1
  }
}
```

### Query Options
```typescript
{
  query: {
    filters: { status: 'active' },
    sort: [
      { field: 'created_at', direction: 'desc' },
      { field: 'name', direction: 'asc' }
    ]
  }
}
```

### Error Handling
All datasources throw specific error types:
- `NetworkError` - Network connectivity issues
- `AuthenticationError` - Authentication failures
- `NotFoundError` - Resource not found (404)
- `TimeoutError` - Request timeout
- `InvalidConfigError` - Configuration validation errors

### Retry Logic
Built-in retry logic with exponential backoff for transient failures.

### Telemetry
Automatic OpenTelemetry spans for observability.

### Validation
Input validation using Zod schemas.

## Creating Custom Datasources

You can create custom datasources by implementing the `DatasourceDefinition` interface:

```typescript
const customDatasourceDefinition: DatasourceDefinition = {
  id: 'custom-api',
  name: 'Custom API',
  description: 'My custom API integration',
  configSchema: {
    type: 'object',
    properties: {
      apiKey: { type: 'string' },
      baseUrl: { type: 'string' }
    },
    required: ['apiKey', 'baseUrl']
  },
  createInstance: (config) => ({
    id: '',
    definitionId: 'custom-api',
    config,
    methods: {
      getData: async (options) => {
        // Your implementation
        return { data: [] };
      }
    }
  })
};

catalog.registerDatasource(customDatasourceDefinition);
```