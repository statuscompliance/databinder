# Core Functionality

This document covers the core components of DataBinder: `DataBinder` and `Linker` classes.

## DataBinder

The `DataBinder` class is the main entry point for fetching data from multiple datasources. It provides a unified interface to work with different data sources and response formats.

### Basic Usage

```typescript
import { DataBinder, Linker } from '@statuscompliance/databinder';

// Create a linker with your datasources
const linker = new Linker({
  datasources: [myRestApiDatasource, myGithubDatasource]
});

// Create a DataBinder instance
const dataBinder = new DataBinder({
  linker,
  responseFormat: 'full', // or 'iterator', 'stream'
  defaultBatchSize: 100
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `linker` | `Linker` | Required | The linker instance managing datasources |
| `responseFormat` | `'full' \| 'iterator' \| 'stream'` | `'full'` | Default response format |
| `defaultBatchSize` | `number` | `100` | Default batch size for iterator mode |

### Methods

#### fetchAll(options?)

Fetches data from all configured datasources or a specific subset.

```typescript
// Fetch from all datasources
const allData = await dataBinder.fetchAll();

// Fetch from specific datasources
const specificData = await dataBinder.fetchAll({
  datasourceIds: ['github-api', 'rest-api']
});

// Use iterator mode for large datasets
const iterator = await dataBinder.fetchAll({
  responseFormat: 'iterator',
  batchSize: 50
});

// Process batches
for await (const batch of iterator) {
  console.log(`Processing batch with ${batch.data.length} items`);
  // Process batch.data
}
```

#### fetchFromDatasource(datasourceId, options)

Fetches data from a specific datasource.

```typescript
// Basic fetch
const data = await dataBinder.fetchFromDatasource('github-api', {
  methodName: 'getRepositories',
  filters: { owner: 'octocat' }
});

// With authentication override
const data = await dataBinder.fetchFromDatasource('rest-api', {
  methodName: 'getData',
  authOverride: {
    type: 'bearer',
    token: 'custom-token'
  },
  endpoint: '/custom-endpoint'
});
```

### Fetch Options

All fetch methods accept a `FetchOptions` object with these properties:

```typescript
interface FetchOptions {
  // Response format for this specific request
  responseFormat?: 'full' | 'iterator' | 'stream';
  
  // Specific datasources to query (for fetchAll)
  datasourceIds?: string[];
  
  // Batch size for iterator mode
  batchSize?: number;
  
  // HTTP headers
  headers?: Record<string, string>;
  
  // HTTP cookies
  cookies?: Record<string, string>;
  
  // Authentication override
  authOverride?: {
    type?: string;
    token?: string;
    username?: string;
    password?: string;
    headerValue?: string;
    cookies?: Record<string, string>;
  };
  
  // Specific endpoint to call
  endpoint?: string;
  
  // Method name to execute
  methodName?: string;
  
  // Response handling options
  responseOptions?: {
    fullResponse?: boolean;
    throwHttpErrors?: boolean;
  };
  
  // Pagination options
  pagination?: {
    enabled: boolean;
    pageSize?: number;
    startPage?: number;
  };
  
  // Query options
  query?: {
    filters?: Record<string, any>;
    sort?: {
      field: string;
      direction: 'asc' | 'desc';
    }[];
  };
  
  // Any additional properties for specific datasource methods
  [key: string]: any;
}
```

### Response Formats

#### Full Response (default)

Returns all data at once in a simple object format:

```typescript
const result = await dataBinder.fetchAll();
// Result structure:
// {
//   'datasource-1': { data: [...] },
//   'datasource-2': { data: [...] }
// }
```

#### Iterator Response

Returns an async iterator for processing large datasets in batches:

```typescript
const iterator = await dataBinder.fetchAll({ responseFormat: 'iterator' });

for await (const batch of iterator) {
  console.log('Batch metadata:', batch.metadata);
  // {
  //   currentPage: 1,
  //   totalPages: 10,
  //   hasNextPage: true,
  //   totalItems: 1000
  // }
  
  // Process batch.data
  batch.data.forEach(item => {
    // Process each item
  });
}
```

## Linker

The `Linker` class manages multiple datasources and their configurations, including method mappings and property transformations.

### Basic Usage

```typescript
import { Linker } from '@statuscompliance/databinder';

const linker = new Linker({
  datasources: [datasource1, datasource2],
  datasourceConfigs: {
    'datasource-1': {
      id: 'datasource-1',
      methodConfig: {
        methodName: 'customMethod',
        options: { defaultParam: 'value' }
      },
      propertyMapping: {
        'old_property': 'newProperty',
        'api_id': 'id'
      }
    }
  },
  defaultMethodName: 'getData'
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `datasources` | `Datasource[]` | Required | Array of datasource instances |
| `datasourceConfigs` | `Record<string, DatasourceConfig>` | `{}` | Per-datasource configurations |
| `defaultMethodName` | `string` | `'default'` | Default method name to call |

### Methods

#### getDatasource(id)

Gets a datasource by its ID.

```typescript
const datasource = linker.getDatasource('github-api');
if (datasource) {
  // Use the datasource
}
```

#### getMethodForDatasource(datasourceId, methodName?)

Gets the method to call for a specific datasource.

```typescript
const { method, methodName, options } = linker.getMethodForDatasource('github-api');
const result = await method(options);
```

#### getMappingForDatasource(datasourceId)

Gets the property mapping for a specific datasource.

```typescript
const mapping = linker.getMappingForDatasource('rest-api');
// Returns: { 'old_prop': 'newProp', 'api_id': 'id' }
```

#### addDatasource(datasource, config?)

Adds a new datasource to the linker.

```typescript
linker.addDatasource(newDatasource, {
  id: 'new-api',
  methodConfig: {
    methodName: 'fetchData',
    options: { timeout: 5000 }
  }
});
```

#### removeDatasource(datasourceId)

Removes a datasource from the linker.

```typescript
const removed = linker.removeDatasource('old-api');
console.log('Datasource removed:', removed); // true or false
```

#### setMapping(datasourceId, mapping)

Sets property mapping for a datasource.

```typescript
linker.setMapping('rest-api', {
  'user_name': 'username',
  'created_at': 'createdDate'
});
```

## Property Mapping

Property mapping allows you to transform property names from datasource responses:

```typescript
// Original API response
{
  "user_id": 123,
  "user_name": "john_doe",
  "created_at": "2024-01-15T10:30:00Z"
}

// With mapping: { "user_id": "id", "user_name": "name", "created_at": "createdAt" }
{
  "id": 123,
  "name": "john_doe",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Complete Example

```typescript
import { DataBinder, Linker } from '@statuscompliance/databinder';
import { RestApiDatasource, GithubApiDatasource } from '@statuscompliance/databinder/Datasources';

// Create datasource instances
const restApi = RestApiDatasource.createInstance({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key'
});
restApi.id = 'rest-api';

const githubApi = GithubApiDatasource.createInstance({
  token: 'github-token'
});
githubApi.id = 'github-api';

// Create linker with configurations
const linker = new Linker({
  datasources: [restApi, githubApi],
  datasourceConfigs: {
    'rest-api': {
      id: 'rest-api',
      methodConfig: {
        methodName: 'get',
        options: { timeout: 10000 }
      },
      propertyMapping: {
        'api_id': 'id',
        'full_name': 'name'
      }
    },
    'github-api': {
      id: 'github-api',
      methodConfig: {
        methodName: 'getRepositories',
        options: { sort: 'updated' }
      }
    }
  },
  defaultMethodName: 'default'
});

// Create DataBinder
const dataBinder = new DataBinder({
  linker,
  responseFormat: 'full',
  defaultBatchSize: 50
});

// Fetch data
async function fetchData() {
  try {
    // Fetch from all datasources
    const allData = await dataBinder.fetchAll();
    console.log('All data:', allData);
    
    // Fetch from specific datasource
    const githubData = await dataBinder.fetchFromDatasource('github-api', {
      methodName: 'getUser',
      filters: { username: 'octocat' }
    });
    console.log('GitHub data:', githubData);
    
    // Use iterator for large datasets
    const iterator = await dataBinder.fetchAll({
      responseFormat: 'iterator',
      batchSize: 25
    });
    
    for await (const batch of iterator) {
      console.log(`Processing ${batch.data.length} items...`);
      // Process batch.data
    }
    
  } catch (error) {
    console.error('Error fetching data:', error);
  }
}

fetchData();
```