# DataBinder

> **A powerful TypeScript library for unified data integration across multiple sources**

DataBinder simplifies the complexity of working with multiple APIs and data sources by providing a unified interface, robust error handling, intelligent retry logic, and enterprise-grade features like persistence, validation, and observability.

## ✨ Key Features

- 🔗 **Universal Data Integration** - Connect to REST APIs, GitHub, Microsoft Graph, OwnCloud/WebDAV, and more
- 📦 **Datasource Catalog** - Register, manage, and persist datasource configurations
- 🚀 **Flexible Response Formats** - Full, batch, iterator, and stream processing
- 🔄 **Smart Retry Logic** - Exponential backoff with configurable retry conditions  
- 🛡️ **Built-in Security** - Input validation, sanitization, and authentication handling
- 📊 **Observability Ready** - OpenTelemetry integration with automatic instrumentation
- 💾 **Persistence Layer** - Database and file-based storage for datasource instances
- 🎯 **Property Mapping** - Transform and normalize data across different sources
- 🔍 **Method Introspection** - Discover, validate, and inspect datasource methods at runtime
- 📄 **Document Parsing** - Extract content from PDFs, Word documents, and more via OwnCloud
- 📄 **Comprehensive Documentation** - Detailed guides and examples for every feature

## 🚀 Quick Start

```bash
npm install @statuscompliance/databinder
```

### Basic Example

```typescript
import { DataBinder, Linker, DatasourceCatalog } from '@statuscompliance/databinder';
import { RestApiDatasource } from '@statuscompliance/databinder/Datasources';

// 1. Create catalog and register datasources
const catalog = new DatasourceCatalog();
catalog.registerDatasource(RestApiDatasource);

// 2. Create datasource instance
const apiInstance = catalog.createDatasourceInstance('rest-api', {
  baseUrl: 'https://api.example.com',
  auth: { type: 'bearer', token: 'your-token' }
}, 'my-api');

// 3. Create linker with datasource configuration
const linker = new Linker({ 
  datasources: [apiInstance],
  datasourceConfigs: {
    'my-api': {
      id: 'my-api',
      methodConfig: {
        methodName: 'default',
        options: { endpoint: '/users' }
      }
    }
  }
});
const dataBinder = new DataBinder({ linker });

// 4. Fetch data (uses configured method)
const data = await dataBinder.fetchAll();

// Or call a specific method with custom options
const users = await dataBinder.fetchFromDatasource('my-api', {
  methodName: 'default',
  endpoint: '/users'
});
```

## 📚 Documentation

| Topic | Description | Link |
|-------|-------------|------|
| **Core Functionality** | DataBinder and Linker classes | [📖 Read More](./docs/core-functionality.md) |
| **Datasource Catalog** | Registration, persistence, and management | [📖 Read More](./docs/catalog.md) |
| **Built-in Datasources** | REST API, GitHub, Microsoft Graph | [📖 Read More](./docs/datasources.md) |
| **Utilities** | Validation, sanitization, logging, telemetry | [📖 Read More](./docs/utilities.md) |

## 🔌 Supported Datasources

### REST API Datasource
Generic REST API integration with full HTTP method support, authentication, and error handling.

```typescript
const restApi = catalog.createDatasourceInstance('rest-api', {
  baseUrl: 'https://api.example.com',
  auth: { type: 'bearer', token: 'token' },
  headers: { 'Content-Type': 'application/json' }
}, 'my-rest-api');
```

### GitHub API Datasource  
Specialized GitHub integration with pre-built methods for repositories, issues, pull requests, and more.

```typescript
const githubApi = catalog.createDatasourceInstance('github-api', {
  personalAccessToken: 'ghp_xxxxxxxxxxxx',
  defaultOrg: 'your-org'
}, 'my-github');
```

### Microsoft Graph Datasource
Access Microsoft 365 services including users, groups, mail, and SharePoint.

```typescript
const graphApi = catalog.createDatasourceInstance('microsoft-graph', {
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret'
}, 'my-graph');
```

### OwnCloud/WebDAV Datasource
Connect to OwnCloud/Nextcloud servers with WebDAV support for file operations and document parsing.

```typescript
const ownCloud = catalog.createDatasourceInstance('owncloud', {
  baseUrl: 'https://cloud.example.com',
  username: 'your-username',
  password: 'your-password'
}, 'my-owncloud');
```

## 🏗️ Architecture Overview

DataBinder follows a modular architecture that promotes reusability and extensibility:

```
┌─────────────────┐    ┌─────────────────┐    ┌────────────────────────┐
│   DataBinder    │◄──►│     Linker      │◄──►│     Datasources        │
│                 │    │                 │    │ • REST API             │
│ • fetchAll()    │    │ • Method config │    │ • GitHub API           │
│ • fetchFrom()   │    │ • Introspection │    │ • Microsoft Graph      │
│ • Iterators     │    │ • Validation    │    │ • OwnCloud/WebDAV      │
└─────────────────┘    └─────────────────┘    └────────────────────────┘
         │                       │                         │
         ▼                       ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌────────────────────────┐
│   Utilities     │    │    Catalog      │    │     Persistence        │
│ • Validation    │    │ • Registry      │    │ • Database Adapter     │
│ • Sanitization  │    │ • Factory       │    │ • File System          │
│ • Retry Logic   │    │ • Serialization │    │ • Metadata             │
│ • Telemetry     │    │ • Validation    │    │ • Import/Export        │
│ • Document Utils│    │ • Introspection │    │                        │
└─────────────────┘    └─────────────────┘    └────────────────────────┘
```

## 💡 Advanced Usage

### Batch Processing with Iterator

```typescript
// Process large datasets efficiently
const iterator = await dataBinder.fetchAll({ 
  responseFormat: 'iterator',
  batchSize: 100 
});

for await (const batch of iterator) {
  console.log(`Processing ${batch.data.length} items...`);
  await processBatch(batch.data);
}
```

### Working with OwnCloud/WebDAV

```typescript
import { OwnCloudDatasource } from '@statuscompliance/databinder/Datasources';

// Register and create OwnCloud instance
catalog.registerDatasource(OwnCloudDatasource);
const ownCloud = catalog.createDatasourceInstance('owncloud', {
  baseUrl: 'https://cloud.example.com',
  username: 'user',
  password: 'pass'
}, 'my-owncloud');

// Configure linker with OwnCloud datasource
const linker = new Linker({
  datasources: [ownCloud],
  datasourceConfigs: {
    'my-owncloud': {
      id: 'my-owncloud',
      methodConfig: {
        methodName: 'listRecursive',
        options: { path: '/', maxDepth: 3 }
      }
    }
  }
});

// Fetch and parse documents
const document = await dataBinder.fetchFromDatasource('my-owncloud', {
  methodName: 'getDocument',
  path: '/Documents/report.pdf',
  parseContent: true
});

console.log(document.content); // Extracted text content
console.log(document.metadata); // Document metadata (author, creation date, etc.)
```

### Property Mapping and Transformation

```typescript
const linker = new Linker({
  datasources: [apiInstance],
  datasourceConfigs: {
    'my-api': {
      id: 'my-api',
      methodConfig: {
        methodName: 'default',
        options: { endpoint: '/users' }
      },
      propertyMapping: {
        'user_id': 'id',
        'full_name': 'name',
        'created_at': 'createdDate'
      }
    }
  }
});
```

### Database Persistence

```typescript
import { DatabaseAdapter, SerializedDatasourceInstance } from '@statuscompliance/databinder';

// Create database adapter
class MongoDBAdapter implements DatabaseAdapter {
  constructor(private db: any) {}
  
  async save(instances: SerializedDatasourceInstance[]): Promise<void> {
    const operations = instances.map(instance => ({
      replaceOne: {
        filter: { id: instance.id },
        replacement: instance,
        upsert: true
      }
    }));
    await this.db.collection('datasources').bulkWrite(operations);
  }
  
  async load(): Promise<SerializedDatasourceInstance[]> {
    return await this.db.collection('datasources').find({}).toArray();
  }
  
  // Optional methods for single instance operations
  async saveOne(instance: SerializedDatasourceInstance): Promise<void> {
    await this.db.collection('datasources').replaceOne(
      { id: instance.id },
      instance,
      { upsert: true }
    );
  }
  
  async loadOne(id: string): Promise<SerializedDatasourceInstance | null> {
    return await this.db.collection('datasources').findOne({ id });
  }
}

// Use with catalog
const dbAdapter = new MongoDBAdapter(mongoDb);
await catalog.saveToDatabaseAdapter(dbAdapter, true); // Include metadata
await catalog.loadFromDatabaseAdapter(dbAdapter);
```

### Method Introspection

Discover available methods and validate options before execution:

```typescript
// List all available methods in a datasource
const methods = linker.listMethods('my-api');
console.log(methods); // ['default', 'getById', 'search', ...]

// Get detailed information about a method
const methodInfo = linker.getMethodInfo('my-api', 'getById');
console.log(methodInfo.description);
console.log(methodInfo.requiredOptions);

// Validate options before calling a method
const validation = linker.validateMethodOptions('my-api', 'getById', {
  id: '123',
  endpoint: '/users'
});
if (!validation.success) {
  console.error('Invalid options:', validation.errors);
}

// Get all methods metadata
const allMethods = linker.getAllMethodsInfo('my-api');
```

### Custom Datasource Creation

```typescript
const customDatasource: DatasourceDefinition = {
  id: 'custom-api',
  name: 'My Custom API',
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

catalog.registerDatasource(customDatasource);
```

## 🌟 Use Cases

- **API Aggregation** - Combine data from multiple APIs into unified responses
- **Data Pipeline Integration** - Connect various data sources in ETL processes  
- **Microservices Communication** - Standardize inter-service data fetching
- **Analytics Platform** - Collect data from diverse sources for analysis
- **Node-RED Integration** - Persistent datasource instances for flow reusability
- **Multi-tenant Applications** - Isolated datasource configurations per tenant
- **Document Management** - Parse and extract content from cloud storage (OwnCloud/Nextcloud)
- **Content Migration** - Transfer and transform data between different systems

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## 🔗 Links

- [npm package](https://www.npmjs.com/package/@statuscompliance/databinder)
- [GitHub repository](https://github.com/statuscompliance/databinder)
- [Documentation](./docs/)
- [Issues](https://github.com/statuscompliance/databinder/issues)

## License

Apache License 2.0