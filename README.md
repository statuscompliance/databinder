# DataBinder

A TypeScript library designed to simplify integration with multiple data sources in a generic way.

## Features

- **Data Source Management**: Integrate and manage multiple data sources with custom configurations.
- **Property Mapping**: Redefine property names between different data sources.
- **Flexible Response Options**: Supports full, batch, or iterable responses.
- **Pagination Support**: Control result pagination for data sources that support it.
- **Advanced Query Configuration**: Filtering, sorting, and custom options for each data source.

## Installation

```bash
npm install databinder
```

## Basic Usage

```typescript
import { DataBinder, Linker, DatasourceCatalog } from 'databinder';

// Set up the data source catalog
const catalog = new DatasourceCatalog();

// Register a data source definition
catalog.registerDatasource({
  id: 'api-source',
  name: 'API Source',
  createInstance: (config) => {
    return {
      id: '',  // Will be assigned by the catalog
      config,
      methods: {
        default: async () => {
          // Implementation to retrieve data
          return { items: [{ id: 1, title: 'Item 1' }] };
        }
      }
    };
  }
});

// Create a data source instance
const apiSource = catalog.createDatasourceInstance(
  'api-source', 
  { url: 'https://api.example.com/data' }
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
const batchResults = await dataBinder.fetchAll({ responseFormat: 'batch', batchSize: 10 });

// Use the iterator to process large data sets
const iterator = await dataBinder.fetchAll({ responseFormat: 'iterator' });
for await (const batch of iterator) {
  console.log(`Processing batch with ${batch.data.length} items`);
  // Process batch.data
}
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

const results = await dataBinder.fetchFromDatasource('my-source-id', { options });
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

const results = await dataBinder.fetchFromDatasource('my-source-id', { options });
```

## License

Apache License 2.0