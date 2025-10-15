# DatasourceCatalog

The `DatasourceCatalog` class manages datasource definitions and instances, providing registration, creation, serialization, and persistence capabilities.

## Overview

The catalog serves as a registry for datasource definitions and a factory for creating datasource instances. It also provides powerful persistence capabilities including database adapters and file-based storage.

## Basic Usage

```typescript
import { DatasourceCatalog } from '@statuscompliance/databinder';
import { RestApiDatasource, GithubApiDatasource } from '@statuscompliance/databinder/Datasources';

// Create catalog instance
const catalog = new DatasourceCatalog();

// Register datasource definitions
catalog.registerDatasource(RestApiDatasource);
catalog.registerDatasource(GithubApiDatasource);

// Create datasource instances
const restInstance = catalog.createDatasourceInstance('rest-api', {
  baseUrl: 'https://api.example.com',
  apiKey: 'your-key'
}, 'my-rest-api');

const githubInstance = catalog.createDatasourceInstance('github-api', {
  token: 'github-token'
}, 'my-github-api');
```

## Core Methods

### registerDatasource(definition)

Registers a datasource definition in the catalog.

```typescript
const myDatasourceDefinition = {
  id: 'custom-api',
  name: 'Custom API',
  description: 'My custom API datasource',
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
        // Implementation
      }
    }
  })
};

catalog.registerDatasource(myDatasourceDefinition);
```

### createDatasourceInstance(definitionId, config, instanceId?)

Creates a datasource instance from a registered definition.

```typescript
// Auto-generated ID
const instance1 = catalog.createDatasourceInstance('rest-api', config);

// Custom ID
const instance2 = catalog.createDatasourceInstance('rest-api', config, 'my-custom-id');
```

### getDatasourceInstance(instanceId)

Retrieves a datasource instance by ID.

```typescript
const instance = catalog.getDatasourceInstance('my-rest-api');
if (instance) {
  // Use the instance
}
```

### listDatasourceDefinitions() / listDatasourceInstances()

Lists all registered definitions or created instances.

```typescript
const definitions = catalog.listDatasourceDefinitions();
const instances = catalog.listDatasourceInstances();
```

## Serialization and Persistence

### File-Based Persistence

```typescript
// Save instances to file (with optional metadata)
await catalog.saveInstancesToFile('./datasources.json', true);

// Load instances from file
await catalog.loadInstancesFromFile('./datasources.json');
```

### Database Persistence

#### 1. Database Adapter Interface

The `DatabaseAdapter` interface allows you to integrate with any database system:

```typescript
interface DatabaseAdapter {
  save(instances: SerializedDatasourceInstance[]): Promise<void>;
  load(): Promise<SerializedDatasourceInstance[]>;
  saveOne?(instance: SerializedDatasourceInstance): Promise<void>;
  loadOne?(id: string): Promise<SerializedDatasourceInstance | null>;
}
```

### 2. Enhanced Serialization with Metadata

Serialized instances now support metadata for better database management:

```typescript
interface SerializedDatasourceInstance {
  id: string;
  definitionId: string;
  config: DatasourceConfig;
  metadata?: {
    createdAt?: Date;
    updatedAt?: Date;
    tags?: string[];
    description?: string;
    [key: string]: any;
  };
}
```

### 3. New DatasourceCatalog Methods

#### Database Persistence
- `saveToDatabaseAdapter(adapter, includeMetadata?)` - Save all instances to database
- `loadFromDatabaseAdapter(adapter)` - Load all instances from database
- `saveInstanceToDatabaseAdapter(adapter, instanceId, includeMetadata?)` - Save single instance
- `loadInstanceFromDatabaseAdapter(adapter, instanceId)` - Load single instance

#### Partial Restoration
- `restoreInstance(id, definitionId, config)` - Restore a single instance by ID

#### Enhanced File Operations
- `saveInstancesToFile(filePath, includeMetadata?)` - Enhanced with metadata support
- `serializeInstances(includeMetadata?)` - Enhanced with metadata support

## Usage Examples

### Basic Database Adapter

```typescript
import { DatabaseAdapter, SerializedDatasourceInstance } from '@statuscompliance/databinder';

class MyDatabaseAdapter implements DatabaseAdapter {
  async save(instances: SerializedDatasourceInstance[]): Promise<void> {
    // Save all instances to your database
    await this.db.collection('datasources').replaceMany(instances);
  }

  async load(): Promise<SerializedDatasourceInstance[]> {
    // Load all instances from your database
    return await this.db.collection('datasources').find({}).toArray();
  }

  // Optional: Single instance operations
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
```

### Node-RED Integration Pattern

```typescript
// Node-RED startup
const catalog = new DatasourceCatalog();
const dbAdapter = new MyDatabaseAdapter();

// Register datasource definitions
catalog.registerDatasource(RestApiDatasource);
catalog.registerDatasource(GithubApiDatasource);

// Load existing instances from database
await catalog.loadFromDatabaseAdapter(dbAdapter);

// In Node-RED flow node
node.on('input', async (msg) => {
  const datasourceId = msg.datasourceId;
  
  // Get instance from catalog
  const instance = catalog.getDatasourceInstance(datasourceId);
  
  if (!instance) {
    // Try to load single instance from database
    const loaded = await catalog.loadInstanceFromDatabaseAdapter(dbAdapter, datasourceId);
    if (!loaded) {
      node.error(`Datasource ${datasourceId} not found`);
      return;
    }
  }
  
  // Use the datasource
  const linker = new Linker({ datasources: [instance] });
  const dataBinder = new DataBinder({ linker });
  
  const result = await dataBinder.fetchFromDatasource(datasourceId, msg.options);
  msg.payload = result;
  node.send(msg);
});
```

### Creating Instances with Metadata

```typescript
// Create instance
const instance = catalog.createDatasourceInstance('rest-api', config, 'my-api-1');

// Save with metadata
await catalog.saveToDatabaseAdapter(dbAdapter, true); // includeMetadata = true

// The serialized instance will include:
// {
//   id: 'my-api-1',
//   definitionId: 'rest-api',
//   config: { ... },
//   metadata: {
//     createdAt: '2024-01-15T10:30:00Z',
//     updatedAt: '2024-01-15T10:30:00Z',
//     tags: [],
//     description: 'Datasource instance of type rest-api'
//   }
// }
```

### Single Instance Operations

```typescript
// Restore a single instance
const instance = await catalog.restoreInstance(
  'new-instance-1',
  'github-api',
  { token: 'abc123', baseUrl: 'https://api.github.com' }
);

// Save only this instance to database
await catalog.saveInstanceToDatabaseAdapter(dbAdapter, 'new-instance-1', true);

// Load a specific instance from database
const loaded = await catalog.loadInstanceFromDatabaseAdapter(dbAdapter, 'new-instance-1');
```

## Migration from v1.0.1

The new features are backwards compatible. Existing code will continue to work without changes:

```typescript
// This still works exactly as before
const serialized = catalog.serializeInstances();
catalog.restoreInstances(serialized);

// But you can now also use:
const serializedWithMeta = catalog.serializeInstances(true); // Include metadata
await catalog.saveToDatabaseAdapter(dbAdapter); // Database persistence
```

## Database Adapter Examples

See `/examples/database-persistence.ts` for a complete example with a MongoDB-style adapter.

Common database adapters you might implement:
- MongoDB with Mongoose
- PostgreSQL with node-postgres
- Redis for caching
- SQLite for local storage
- Cloud databases (Azure Cosmos DB, AWS DynamoDB, etc.)