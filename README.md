# DataBinder

> **A powerful TypeScript library for unified data integration across multiple sources**

DataBinder simplifies the complexity of working with multiple APIs and data sources by providing a unified interface, intelligent caching, robust error handling, and enterprise-grade features like persistence, validation, and observability.

## ✨ Key Features

- 🔗 **Universal Data Integration** - Connect to REST APIs, GitHub, Microsoft Graph, and more
- 📦 **Datasource Catalog** - Register, manage, and persist datasource configurations
- 🚀 **Flexible Response Formats** - Full, batch, iterator, and stream processing
- 🔄 **Smart Retry Logic** - Exponential backoff with configurable retry conditions  
- 🛡️ **Built-in Security** - Input validation, sanitization, and authentication handling
- 📊 **Observability Ready** - OpenTelemetry integration with automatic instrumentation
- 💾 **Persistence Layer** - Database and file-based storage for datasource instances
- 🎯 **Property Mapping** - Transform and normalize data across different sources
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

// 3. Create linker and databinder
const linker = new Linker({ datasources: [apiInstance] });
const dataBinder = new DataBinder({ linker });

// 4. Fetch data
const data = await dataBinder.fetchFromDatasource('my-api', {
  methodName: 'get',
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
});
```

### GitHub API Datasource  
Specialized GitHub integration with pre-built methods for repositories, issues, pull requests, and more.

```typescript
const githubApi = catalog.createDatasourceInstance('github-api', {
  personalAccessToken: 'ghp_xxxxxxxxxxxx',
  defaultOrg: 'your-org'
});
```

### Microsoft Graph Datasource
Access Microsoft 365 services including users, groups, mail, and SharePoint.

```typescript
const graphApi = catalog.createDatasourceInstance('microsoft-graph', {
  tenantId: 'tenant-id',
  clientId: 'client-id',
  clientSecret: 'client-secret'
});
```

## 🏗️ Architecture Overview

DataBinder follows a modular architecture that promotes reusability and extensibility:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DataBinder    │◄──►│     Linker      │◄──►│   Datasources   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Utilities     │    │    Catalog      │    │  Persistence    │
│ • Validation    │    │ • Registry      │    │ • Database      │
│ • Sanitization │    │ • Factory       │    │ • File System   │
│ • Retry Logic   │    │ • Serialization │    │ • Metadata      │
│ • Telemetry     │    │ • Validation    │    │ • Migration     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
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

### Property Mapping and Transformation

```typescript
const linker = new Linker({
  datasources: [apiInstance],
  datasourceConfigs: {
    'my-api': {
      id: 'my-api',
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
// Create database adapter
class MongoDBAdapter implements DatabaseAdapter {
  async save(instances: SerializedDatasourceInstance[]): Promise<void> {
    await this.db.collection('datasources').replaceMany(instances);
  }
  
  async load(): Promise<SerializedDatasourceInstance[]> {
    return await this.db.collection('datasources').find({}).toArray();
  }
}

// Use with catalog
const dbAdapter = new MongoDBAdapter();
await catalog.saveToDatabaseAdapter(dbAdapter, true); // Include metadata
await catalog.loadFromDatabaseAdapter(dbAdapter);
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