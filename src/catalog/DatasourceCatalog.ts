import { Datasource, DatasourceConfig, DatasourceDefinition } from '../datasources/types';
import fs from 'fs/promises';
import path from 'path';

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
      this.validateConfig(config, definition.configSchema);
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
   * Validates datasource configuration against a schema.
   * 
   * @param config - The configuration to validate
   * @param schema - The schema to validate against
   * @throws InvalidConfigError if validation fails
   */
  private validateConfig(config: DatasourceConfig, schema: Record<string, any>): void {
    // Import InvalidConfigError
    const { InvalidConfigError } = require('../core/errors');
    
    // Validar propiedades requeridas
    if (schema.required && Array.isArray(schema.required)) {
      const missingProps = [];
      
      for (const requiredProp of schema.required) {
        // Comprobar si la propiedad existe y no es undefined
        if (!(requiredProp in config) || config[requiredProp] === undefined) {
          missingProps.push(requiredProp);
        }
      }
      
      if (missingProps.length > 0) {
        throw new InvalidConfigError(
          `Missing required ${missingProps.length > 1 ? 'properties' : 'property'} in datasource configuration: ${missingProps.join(', ')}`,
          missingProps.join(', '),
          undefined,
          undefined,
          { schema: schema.title || 'datasource schema' }
        );
      }
    }

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties) as [string, any][]) {
        if (propName in config && config[propName] !== undefined) {
          try {
            this.validateProperty(propName, config[propName], propSchema);
          } catch (error) {
            if (error instanceof Error) {
              throw new InvalidConfigError(
                error.message,
                propName,
                propSchema.type,
                config[propName],
                { schema: schema.title || 'datasource schema' }
              );
            }
            throw error;
          }
        }
      }
    }
  }

  /**
   * Validates a single property against its schema definition
   * 
   * @param propName - The name of the property
   * @param value - The value to validate
   * @param propSchema - The schema for this property
   * @throws Error if validation fails
   */
  private validateProperty(propName: string, value: any, propSchema: any): void {
    // Validar tipo
    if (propSchema.type) {
      const type = typeof value;
      if (propSchema.type === 'array' && !Array.isArray(value)) {
        throw new Error(`Property '${propName}' should be an array`);
      } else if (propSchema.type === 'object' && (type !== 'object' || Array.isArray(value))) {
        throw new Error(`Property '${propName}' should be an object`);
      } else if (propSchema.type !== 'array' && propSchema.type !== 'object' && propSchema.type !== type) {
        throw new Error(`Property '${propName}' should be of type '${propSchema.type}' but got '${type}'`);
      }
    }

    // Validar restricciones de longitud para strings
    if (typeof value === 'string') {
      if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
        throw new Error(`Property '${propName}' should have minimum length of ${propSchema.minLength}`);
      }
      if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
        throw new Error(`Property '${propName}' should have maximum length of ${propSchema.maxLength}`);
      }
    }

    // Validar restricciones para números
    if (typeof value === 'number') {
      if (propSchema.minimum !== undefined && value < propSchema.minimum) {
        throw new Error(`Property '${propName}' should be at least ${propSchema.minimum}`);
      }
      if (propSchema.maximum !== undefined && value > propSchema.maximum) {
        throw new Error(`Property '${propName}' should be at most ${propSchema.maximum}`);
      }
    }

    // Validar enum
    if (propSchema.enum && !propSchema.enum.includes(value)) {
      throw new Error(`Property '${propName}' should be one of: ${propSchema.enum.join(', ')}`);
    }
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
    
    // Ensure directory exists
    const directory = path.dirname(filePath);
    await fs.mkdir(directory, { recursive: true });
    
    await fs.writeFile(filePath, jsonContent, 'utf8');
  }

  /**
   * Loads datasource instances from a JSON file
   * 
   * @param filePath - Path to the instances file
   * @returns Promise that resolves when instances are loaded
   */
  async loadInstancesFromFile(filePath: string): Promise<void> {
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const instances = JSON.parse(fileContent) as Array<{ 
        id: string, 
        definitionId: string, 
        config: DatasourceConfig 
      }>;
      
      this.restoreInstances(instances);
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
