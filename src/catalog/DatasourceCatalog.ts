import { Datasource, DatasourceConfig, DatasourceDefinition, DatabaseAdapter, SerializedDatasourceInstance } from '../datasources/types';
import fs from 'fs/promises';
import path from 'path';
import { validateInput } from '../utils/validation';
import { sanitizeFilename } from '../utils/sanitize';
import { z } from 'zod';

/**
 * Manages datasource definitions and instances.
 * Provides methods to register, create, and retrieve datasources.
 */
export class DatasourceCatalog {
  private definitions: Map<string, DatasourceDefinition> = new Map();
  private instances: Map<string, Datasource> = new Map();

  /**
   * Registers a datasource definition in the catalog.
   * 
   * @param definition - The datasource definition to register
   * @throws Error if a definition with the same ID already exists
   */
  registerDatasource(definition: DatasourceDefinition): void {
    if (this.definitions.has(definition.id)) {
      throw new Error(`Datasource with ID '${definition.id}' already exists in the catalog`);
    }
    this.definitions.set(definition.id, definition);
  }

  /**
   * Creates a datasource instance from a registered definition.
   * 
   * @param definitionId - The ID of the datasource definition
   * @param config - Configuration for the datasource instance
   * @param instanceId - Optional custom ID for the instance (generated if not provided)
   * @returns The created datasource instance
   * @throws Error if the definition is not found or instance creation fails
   */
  createDatasourceInstance(definitionId: string, config: DatasourceConfig, instanceId?: string): Datasource {
    const definition = this.definitions.get(definitionId);
    if (!definition) {
      throw new Error(`Datasource definition with ID '${definitionId}' not found in catalog`);
    }

    // Validar el config contra el schema si existe
    if (definition.configSchema) {
      // Convertir schema JSON a schema Zod
      const zodSchema = this.convertJsonSchemaToZod(definition.configSchema);
      validateInput(config, zodSchema);
    }

    const finalInstanceId = instanceId || `${definitionId}_${Date.now()}`;
    
    try {
      const instance = definition.createInstance(config);
      instance.id = finalInstanceId;
      // Add the definition ID to the instance for serialization purposes
      instance.definitionId = definitionId;
      
      this.instances.set(finalInstanceId, instance);
      return instance;
    } catch (error) {
      throw new Error(`Failed to create datasource instance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Convierte un esquema JSON a un esquema Zod
   * 
   * @param jsonSchema - Esquema JSON a convertir
   * @returns Esquema Zod equivalente
   */
  private convertJsonSchemaToZod(jsonSchema: Record<string, any>): z.ZodSchema {
    // Implementación básica de conversión de esquema JSON a Zod
    let schema: z.ZodTypeAny = z.any();
    
    if (jsonSchema.type === 'object') {
      const shape: Record<string, z.ZodTypeAny> = {};
      
      if (jsonSchema.properties) {
        for (const [propName, propSchema] of Object.entries(jsonSchema.properties)) {
          let propType: z.ZodTypeAny = z.any();
          
          // Convertir tipo de propiedad
          if ((propSchema as any).type === 'string') {
            propType = z.string();
            if ((propSchema as any).enum) {
              propType = z.enum((propSchema as any).enum as [string, ...string[]]);
            }
          } else if ((propSchema as any).type === 'number') {
            propType = z.number();
          } else if ((propSchema as any).type === 'boolean') {
            propType = z.boolean();
          } else if ((propSchema as any).type === 'array') {
            propType = z.array(z.any());
          } else if ((propSchema as any).type === 'object') {
            propType = this.convertJsonSchemaToZod(propSchema as Record<string, any>);
          }
          
          // Hacer la propiedad opcional si no es requerida
          if (!jsonSchema.required || !jsonSchema.required.includes(propName)) {
            propType = propType.optional();
          }
          
          shape[propName] = propType;
        }
      }
      
      schema = z.object(shape);
    } else if (jsonSchema.type === 'array') {
      schema = z.array(z.any());
    } else if (jsonSchema.type === 'string') {
      schema = z.string();
    } else if (jsonSchema.type === 'number') {
      schema = z.number();
    } else if (jsonSchema.type === 'boolean') {
      schema = z.boolean();
    }
    
    return schema;
  }

  /**
   * Gets a datasource instance by its ID.
   * 
   * @param instanceId - The ID of the datasource instance
   * @returns The datasource instance or undefined if not found
   */
  getDatasourceInstance(instanceId: string): Datasource | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Gets a datasource definition by its ID.
   * 
   * @param definitionId - The ID of the datasource definition
   * @returns The datasource definition or undefined if not found
   */
  getDatasourceDefinition(definitionId: string): DatasourceDefinition | undefined {
    return this.definitions.get(definitionId);
  }

  /**
   * Lists all registered datasource definitions.
   * 
   * @returns Array of all datasource definitions
   */
  listDatasourceDefinitions(): DatasourceDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Lists all created datasource instances.
   * 
   * @returns Array of all datasource instances
   */
  listDatasourceInstances(): Datasource[] {
    return Array.from(this.instances.values());
  }

  /**
   * Serializes all datasource instances to an array of simple objects with metadata
   * 
   * @param includeMetadata - Whether to include metadata in serialization
   * @returns Array of serialized datasource instances
   */
  serializeInstances(includeMetadata: boolean = false): SerializedDatasourceInstance[] {
    return this.listDatasourceInstances().map(ds => {
      const serialized: SerializedDatasourceInstance = {
        id: ds.id,
        definitionId: ds.definitionId || 'unknown',
        config: ds.config
      };

      if (includeMetadata) {
        serialized.metadata = {
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          description: `Datasource instance of type ${ds.definitionId || 'unknown'}`
        };
      }

      return serialized;
    });
  }

  /**
   * Restores datasource instances from a serialized array
   * 
   * @param instances - Array of serialized datasource instances
   * @throws Error if a definition is not found or instance creation fails
   */
  restoreInstances(instances: SerializedDatasourceInstance[]): void {
    for (const { id, definitionId, config } of instances) {
      try {
        this.createDatasourceInstance(definitionId, config, id);
      } catch (error) {
        console.error(`Failed to restore instance ${id} of type ${definitionId}: ${error}`);
      }
    }
  }

  /**
   * Saves all datasource instances to a JSON file
   * 
   * @param filePath - Path to save the instances file
   * @param includeMetadata - Whether to include metadata in serialization
   * @returns Promise that resolves when file is written
   */
  async saveInstancesToFile(filePath: string, includeMetadata: boolean = false): Promise<void> {
    const serialized = this.serializeInstances(includeMetadata);
    const jsonContent = JSON.stringify(serialized, null, 2);
    
    // Sanitize file path
    const sanitizedFilePath = path.normalize(filePath);
    const sanitizedBasename = sanitizeFilename(path.basename(sanitizedFilePath));
    const directory = path.dirname(sanitizedFilePath);
    const fullPath = path.join(directory, sanitizedBasename);
    
    // Ensure directory exists
    await fs.mkdir(directory, { recursive: true });
    
    await fs.writeFile(fullPath, jsonContent, 'utf8');
  }

  /**
   * Loads datasource instances from a JSON file
   * 
   * @param filePath - Path to the instances file
   * @returns Promise that resolves when instances are loaded
   */
  async loadInstancesFromFile(filePath: string): Promise<void> {
    try {
      // Sanitize file path
      const sanitizedFilePath = path.normalize(filePath);
      const fileContent = await fs.readFile(sanitizedFilePath, 'utf8');
      
      // Validate JSON structure before parsing
      try {
        const instances = validateInput(
          JSON.parse(fileContent),
          z.array(z.object({
            id: z.string(),
            definitionId: z.string(),
            config: z.record(z.any()),
            metadata: z.object({
              createdAt: z.date().optional(),
              updatedAt: z.date().optional(),
              tags: z.array(z.string()).optional(),
              description: z.string().optional()
            }).optional()
          }))
        );
        
        this.restoreInstances(instances);
      } catch (validationError) {
        throw new Error(`Invalid instances file format: ${validationError}`);
      }
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        // File doesn't exist, which is fine for first run
        console.log(`No instances file found at ${filePath}. Starting with empty instances.`);
      } else {
        // Other errors should be reported
        throw new Error(`Failed to load instances from file: ${error}`);
      }
    }
  }

  /**
   * Saves all datasource instances to a database using the provided adapter
   * 
   * @param adapter - Database adapter implementing the DatabaseAdapter interface
   * @param includeMetadata - Whether to include metadata in serialization
   * @returns Promise that resolves when instances are saved
   */
  async saveToDatabaseAdapter(adapter: DatabaseAdapter, includeMetadata: boolean = true): Promise<void> {
    const serialized = this.serializeInstances(includeMetadata);
    await adapter.save(serialized);
  }

  /**
   * Loads datasource instances from a database using the provided adapter
   * 
   * @param adapter - Database adapter implementing the DatabaseAdapter interface
   * @returns Promise that resolves when instances are loaded
   */
  async loadFromDatabaseAdapter(adapter: DatabaseAdapter): Promise<void> {
    try {
      const instances = await adapter.load();
      this.restoreInstances(instances);
    } catch (error) {
      throw new Error(`Failed to load instances from database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Restores a single datasource instance by creating it with the given parameters
   * 
   * @param id - The ID for the datasource instance
   * @param definitionId - The ID of the datasource definition
   * @param config - Configuration for the datasource instance
   * @returns Promise that resolves to the created datasource instance
   * @throws Error if the definition is not found or instance creation fails
   */
  async restoreInstance(id: string, definitionId: string, config: DatasourceConfig): Promise<Datasource> {
    try {
      return this.createDatasourceInstance(definitionId, config, id);
    } catch (error) {
      throw new Error(`Failed to restore instance ${id} of type ${definitionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves a single datasource instance to database using the provided adapter
   * 
   * @param adapter - Database adapter implementing the DatabaseAdapter interface
   * @param instanceId - ID of the instance to save
   * @param includeMetadata - Whether to include metadata in serialization
   * @returns Promise that resolves when instance is saved
   * @throws Error if instance not found or adapter doesn't support single saves
   */
  async saveInstanceToDatabaseAdapter(adapter: DatabaseAdapter, instanceId: string, includeMetadata: boolean = true): Promise<void> {
    if (!adapter.saveOne) {
      throw new Error('Database adapter does not support saving single instances');
    }

    const instance = this.getDatasourceInstance(instanceId);
    if (!instance) {
      throw new Error(`Datasource instance with ID '${instanceId}' not found`);
    }

    const serialized: SerializedDatasourceInstance = {
      id: instance.id,
      definitionId: instance.definitionId || 'unknown',
      config: instance.config
    };

    if (includeMetadata) {
      serialized.metadata = {
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [],
        description: `Datasource instance of type ${instance.definitionId || 'unknown'}`
      };
    }

    await adapter.saveOne(serialized);
  }

  /**
   * Loads a single datasource instance from database using the provided adapter
   * 
   * @param adapter - Database adapter implementing the DatabaseAdapter interface
   * @param instanceId - ID of the instance to load
   * @returns Promise that resolves to the loaded datasource instance or null if not found
   * @throws Error if adapter doesn't support single loads
   */
  async loadInstanceFromDatabaseAdapter(adapter: DatabaseAdapter, instanceId: string): Promise<Datasource | null> {
    if (!adapter.loadOne) {
      throw new Error('Database adapter does not support loading single instances');
    }

    try {
      const serializedInstance = await adapter.loadOne(instanceId);
      if (!serializedInstance) {
        return null;
      }

      return await this.restoreInstance(
        serializedInstance.id,
        serializedInstance.definitionId,
        serializedInstance.config
      );
    } catch (error) {
      throw new Error(`Failed to load instance ${instanceId} from database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
