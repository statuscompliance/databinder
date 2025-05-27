import { Datasource, DatasourceConfig, DatasourceDefinition } from '../datasources/types';
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
   * Serializes all datasource instances to an array of simple objects
   * 
   * @returns Array of serialized datasource instances
   */
  serializeInstances(): Array<{ id: string, definitionId: string, config: DatasourceConfig }> {
    return this.listDatasourceInstances().map(ds => ({
      id: ds.id,
      definitionId: ds.definitionId || 'unknown',
      config: ds.config
    }));
  }

  /**
   * Restores datasource instances from a serialized array
   * 
   * @param instances - Array of serialized datasource instances
   * @throws Error if a definition is not found or instance creation fails
   */
  restoreInstances(instances: Array<{ id: string, definitionId: string, config: DatasourceConfig }>): void {
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
   * @returns Promise that resolves when file is written
   */
  async saveInstancesToFile(filePath: string): Promise<void> {
    const serialized = this.serializeInstances();
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
            config: z.record(z.any())
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
}
