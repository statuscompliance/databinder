# DataBinder

A TypeScript library designed to simplify integration with multiple data sources in a generic and extensible way.

## Features

- **Data Source Management**: Integrate and manage multiple data sources with custom configurations.
- **Built-in Datasources**: Integrated support for REST API, GitHub API, and Microsoft Graph.
- **Property Mapping**: Redefine property names between different data sources.
- **Flexible Response Options**: Supports full, batch, or iterable responses.
- **Pagination Support**: Control result pagination for data sources that support it.
- **Advanced Query Configuration**: Filtering, sorting, and custom options for each data source.
- **Datasource Catalog**: System for registering, creating, and managing data source definitions and instances.

## Installation

```bash
npm install databinder
```

## Basic Usage

```typescript
import { DataBinder, Linker, DatasourceCatalog, RestApiDatasource } from 'databinder';

// Set up the data source catalog
const catalog = new DatasourceCatalog();

// Register a preconfigured data source definition
catalog.registerDatasource(RestApiDatasource);

// Create a data source instance
const apiSource = catalog.createDatasourceInstance(
  'rest-api', 
  { 
    baseUrl: 'https://api.example.com',
    defaultEndpoint: '/data',
    auth: {
      type: 'bearer',
      token: 'your-token-here'
    }
  }
);

// Configure a Linker
const linker = new Linker({
  datasources: [apiSource],
  datasourceConfigs: {
    [apiSource.id]: {
      id: apiSource.id,
      propertyMapping: {
        'title': 'name'  // Change 'title' to 'name' in the response
      }
    }
  }
});

// Create and use the DataBinder
const dataBinder = new DataBinder({ linker });

// Get all data
const results = await dataBinder.fetchAll();

// Get data in batch format
const batchResults = await dataBinder.fetchAll({ 
  responseFormat: 'batch', 
  batchSize: 10 
});

// Use the iterator to process large data sets
const iterator = await dataBinder.fetchAll({ responseFormat: 'iterator' });
for await (const batch of iterator) {
  console.log(`Processing batch with ${batch.data.length} items`);
  // Process batch.data
}
```

## Available Datasources

### REST API

```typescript
import { DatasourceCatalog, RestApiDatasource } from 'databinder';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(RestApiDatasource);

const apiSource = catalog.createDatasourceInstance('rest-api', {
  baseUrl: 'https://api.example.com',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  auth: {
    type: 'bearer',
    token: 'your-api-token'
  }
});

// Use specific methods
const data = await apiSource.methods.getById({ id: '123' });
const searchResults = await apiSource.methods.search({ 
  query: { filters: { category: 'books' } } 
});
```

### GitHub API

```typescript
import { DatasourceCatalog, GithubApiDatasource } from 'databinder';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(GithubApiDatasource);

const githubSource = catalog.createDatasourceInstance('github-api', {
  personalAccessToken: 'your-github-pat',
  defaultOrg: 'your-organization',
  defaultRepo: 'your-repository'
});

// Use GitHub-specific methods
const repos = await githubSource.methods.getRepositories();
const issues = await githubSource.methods.getIssues({ 
  state: 'open',
  sort: 'updated',
  direction: 'desc'
});
const pullRequest = await githubSource.methods.getPullRequest({ 
  pullNumber: 123 
});
```

### Microsoft Graph API

```typescript
import { DatasourceCatalog, MicrosoftGraphDatasource } from 'databinder';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(MicrosoftGraphDatasource);

const graphSource = catalog.createDatasourceInstance('microsoft-graph', {
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scopes: ['https://graph.microsoft.com/.default']
});

// Use Microsoft Graph-specific methods
const siteId = await graphSource.methods.getSiteIdByPath({ 
  sitePath: 'sites/contoso.sharepoint.com:/sites/devsite' 
});
const items = await graphSource.methods.listSiteItems({ 
  siteId: siteId.data.id,
  folderPath: 'Documents/Projects' 
});
```

## Main Components

### Datasource

Represents an integrated data source with specific configuration.

### Linker

Object that contains a selection of data sources to consume and an optional property mapping.

### DataBinder

Mechanism responsible for consuming data sources according to the configuration and retrieving the data.

### DatasourceCatalog

Catalog that manages data source definitions and their instances.

## Advanced Options

### Pagination

```typescript
const options = {
  pagination: {
    enabled: true,
    pageSize: 20,
    startPage: 1
  }
};

const results = await dataBinder.fetchFromDatasource('my-source-id', options);
```

### Filtering and Sorting

```typescript
const options = {
  query: {
    filters: {
      category: 'books',
      price: { $gt: 10 }
    },
    sort: [
      { field: 'price', direction: 'asc' }
    ]
  }
};

const results = await dataBinder.fetchFromDatasource('my-source-id', options);
```

### Creating a Custom Datasource

```typescript
import { DatasourceCatalog, DatasourceDefinition } from 'databinder';

// Define a custom datasource
const customDatasource: DatasourceDefinition = {
  id: 'custom-source',
  name: 'Custom Data Source',
  description: 'A custom data source implementation',
  configSchema: {
    type: 'object',
    required: ['endpoint'],
    properties: {
      endpoint: { type: 'string' }
    }
  },
  createInstance: (config) => {
    return {
      id: '',  // Will be assigned by the catalog
      config,
      methods: {
        default: async (options) => {
          // Implementation to retrieve data
          return { data: [{ id: 1, name: 'Item 1' }] };
        },
        customMethod: async (options) => {
          // Custom method
          return { data: { result: 'Success!' } };
        }
      }
    };
  }
};

// Register and use the custom datasource
const catalog = new DatasourceCatalog();
catalog.registerDatasource(customDatasource);
const instance = catalog.createDatasourceInstance('custom-source', { 
  endpoint: 'https://api.mycustomservice.com/data' 
});
```

## License

Apache License 2.0