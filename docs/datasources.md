# Built-in Datasources

DataBinder comes with several built-in datasource implementations for common APIs and services. Each datasource provides a specialized interface optimized for its respective service while maintaining consistency with the DataBinder architecture.

## Available Datasources

### [REST API Datasource](./datasources/rest-api.md)
A flexible, generic REST API datasource that can be configured to work with any RESTful API.

**Key Features:**
- Multiple authentication methods (Bearer, Basic, Cookie, Custom)
- Automatic retry logic with exponential backoff
- Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- Flexible response formats (full, batch, stream)
- Built-in pagination and query support

**Use Cases:**
- Custom REST APIs
- Internal microservices
- Third-party APIs without dedicated datasource
- API prototyping and testing

[📖 View REST API Documentation →](./datasources/rest-api.md)

---

### [GitHub API Datasource](./datasources/github-api.md)
Specialized datasource for the GitHub REST API with pre-configured methods for common GitHub operations.

**Key Features:**
- Pre-built methods for repositories, issues, PRs, users
- Code and issue search capabilities
- Automatic rate limit handling
- Repository contents access
- Organization and team management

**Use Cases:**
- Repository management automation
- Issue and PR tracking
- Code search and analysis
- CI/CD integrations
- Team collaboration tools

[📖 View GitHub API Documentation →](./datasources/github-api.md)

---

### [Microsoft Graph Datasource](./datasources/microsoft-graph.md)
Comprehensive datasource for Microsoft Graph API to access Microsoft 365 services.

**Key Features:**
- Azure AD user and group management
- SharePoint and OneDrive integration
- Email operations (Outlook)
- Calendar and Teams access
- OData query support

**Use Cases:**
- User provisioning and management
- Document management in SharePoint
- Email automation
- Calendar synchronization
- Microsoft 365 integrations

[📖 View Microsoft Graph Documentation →](./datasources/microsoft-graph.md)

---

### [OwnCloud WebDAV Datasource](./datasources/owncloud.md)
WebDAV-based datasource for ownCloud servers with document parsing capabilities.

**Key Features:**
- Full WebDAV protocol support
- Document parsing (ODT, DOCX, PDF detection)
- Metadata extraction
- Recursive file operations
- File search capabilities
- Copy and move operations

**Use Cases:**
- File storage integration
- Document management systems
- Content migration
- Backup and sync operations
- Self-hosted cloud storage

[📖 View OwnCloud Documentation →](./datasources/owncloud.md)

---

## Common Features

All built-in datasources share these powerful features:

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
Input validation and schema validation for configurations.

### Logging
Integrated logging using the DataBinder logger for debugging and monitoring.

## Creating Custom Datasources

You can create custom datasources by implementing the `DatasourceDefinition` interface. See the [Core Functionality](./core-functionality.md) documentation for detailed examples.

### Quick Example

```typescript
import { DatasourceDefinition, DatasourceConfig, Datasource } from '@statuscompliance/databinder/datasources';

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
  createInstance: (config: DatasourceConfig): Datasource => ({
    id: config.id || 'custom-api',
    definitionId: 'custom-api',
    config,
    methods: {
      getData: async (options) => {
        // Your implementation
        const response = await fetch(`${config.baseUrl}/data`, {
          headers: {
            'Authorization': `Bearer ${config.apiKey}`
          }
        });
        return await response.json();
      }
    }
  })
};

// Register and use
const catalog = new DatasourceCatalog();
catalog.registerDatasource(customDatasourceDefinition);

const instance = catalog.createDatasourceInstance('custom-api', {
  apiKey: 'your-key',
  baseUrl: 'https://api.example.com'
}, 'my-custom-api');
```

### Extending REST API Datasource

For REST-based APIs, you can extend the `RestApiDatasource`:

```typescript
import { createRestApiBasedDatasource } from '@statuscompliance/databinder/datasources';

const MyApiDatasource = createRestApiBasedDatasource(
  'my-api',
  'My Custom API',
  'Specialized datasource for My API',
  {
    baseUrl: 'https://api.myservice.com',
    auth: { type: 'bearer' },
    timeout: 10000
  },
  {
    // Add custom methods
    getWidgets: async (options) => {
      // Implementation using fetchData utility
      return await fetchData(config, '/widgets', options);
    }
  }
);

catalog.registerDatasource(MyApiDatasource);
```

## Next Steps

- Explore individual datasource documentation for detailed usage
- Learn about [Core Functionality](./core-functionality.md) for advanced patterns
- Check out [Utilities](./utilities.md) for helper functions
- Review the [Catalog](./catalog.md) for datasource management

## Contributing

Want to add a new datasource? Check our [Contributing Guidelines](../CONTRIBUTING.md) to learn how to create and submit new datasource implementations.

## Support

- 📖 [Full Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/statuscompliance/databinder/issues)
- 💬 [Discussions](https://github.com/statuscompliance/databinder/discussions)