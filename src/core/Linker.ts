import { Datasource, DatasourceMethodOptions, MethodMetadata } from '../datasources/types';

export interface PropertyMapping {
  [originalProp: string]: string;
}

export interface DatasourceMethodConfig {
  methodName: string;
  options?: DatasourceMethodOptions;
}

export interface DatasourceConfig {
  id: string;
  methodConfig?: DatasourceMethodConfig; // Optional - if not provided, method must be specified at runtime
  propertyMapping?: PropertyMapping;
}

export interface LinkerOptions {
  datasources: Datasource[];
  datasourceConfigs: Record<string, DatasourceConfig>;
}

/**
 * Connects and manages multiple datasources with their configurations.
 * Provides methods to access and manipulate datasources and their mappings.
 */
export class Linker {
  datasources: Datasource[];
  datasourceConfigs: Record<string, DatasourceConfig>;
  defaultMethodName: string;

  /**
   * Creates a new Linker instance.
   * 
   * @param options - Configuration options for the Linker
   * @throws Error if any datasource is missing its configuration
   */
  constructor(options: LinkerOptions) {
    this.datasources = options.datasources;
    this.datasourceConfigs = options.datasourceConfigs;
    this.defaultMethodName = 'default';
    
    // Validate configurations if provided
    for (const datasource of this.datasources) {
      const config = this.datasourceConfigs[datasource.id];
      
      // If config exists and has methodConfig, validate it has methodName
      if (config?.methodConfig && !config.methodConfig.methodName) {
        throw new Error(`Datasource '${datasource.id}' methodConfig must include methodName`);
      }
    }
  }

  /**
   * Gets a datasource by its ID.
   * 
   * @param id - The ID of the datasource to retrieve
   * @returns The datasource with the specified ID or undefined if not found
   */
  getDatasource(id: string): Datasource | undefined {
    return this.datasources.find(ds => ds.id === id);
  }

  /**
   * Gets the default configured method for a specific datasource.
   * Returns undefined if no default method is configured.
   * 
   * @param datasourceId - The ID of the datasource
   * @returns An object containing the method, method name, and options, or undefined if no config
   * @throws Error if the datasource is not found or the configured method doesn't exist
   */
  getMethodForDatasource(datasourceId: string): {
    method: (...args: any[]) => Promise<any>;
    methodName: string;
    options?: DatasourceMethodOptions;
  } | undefined {
    const datasource = this.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found in linker`);
    }

    const config = this.datasourceConfigs[datasourceId];
    if (!config?.methodConfig) {
      return undefined; // No default method configured
    }
    
    const methodName = config.methodConfig.methodName;
    const method = datasource.methods[methodName];
    
    if (!method) {
      throw new Error(`Configured method '${methodName}' not found in datasource '${datasourceId}'`);
    }

    return {
      method,
      methodName,
      options: config.methodConfig.options
    };
  }

  /**
   * Gets the property mapping for a specific datasource.
   * 
   * @param datasourceId - The ID of the datasource
   * @returns The property mapping for the specified datasource or undefined if not found
   */
  getMappingForDatasource(datasourceId: string): PropertyMapping | undefined {
    return this.datasourceConfigs[datasourceId]?.propertyMapping;
  }

  /**
   * Gets a specific method from a datasource by name.
   * This allows calling any method on a datasource, not just the configured default.
   * 
   * @param datasourceId - The ID of the datasource
   * @param methodName - The name of the method to retrieve
   * @returns The method function
   * @throws Error if the datasource or method is not found
   */
  getMethod(datasourceId: string, methodName: string): (...args: any[]) => Promise<any> {
    const datasource = this.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found in linker`);
    }

    const method = datasource.methods[methodName];
    if (!method) {
      throw new Error(`Method '${methodName}' not found in datasource '${datasourceId}'`);
    }

    return method;
  }

  /**
   * Adds a datasource to the linker with optional configuration.
   * 
   * @param datasource - The datasource to add
   * @param config - Optional configuration for the datasource
   * @throws Error if a datasource with the same ID already exists or if methodConfig is invalid
   */
  addDatasource(datasource: Datasource, config?: DatasourceConfig): void {
    if (this.datasources.some(ds => ds.id === datasource.id)) {
      throw new Error(`Datasource with ID '${datasource.id}' already exists in linker`);
    }
    
    // If config is provided and has methodConfig, validate it
    if (config?.methodConfig && !config.methodConfig.methodName) {
      throw new Error(`Configuration for datasource '${datasource.id}' methodConfig must include methodName`);
    }
    
    this.datasources.push(datasource);
    if (config) {
      this.datasourceConfigs[datasource.id] = config;
    }
  }

  /**
   * Removes a datasource from the linker.
   * 
   * @param datasourceId - The ID of the datasource to remove
   * @returns True if the datasource was removed, false if it wasn't found
   */
  removeDatasource(datasourceId: string): boolean {
    const initialLength = this.datasources.length;
    this.datasources = this.datasources.filter(ds => ds.id !== datasourceId);
    
    if (this.datasourceConfigs[datasourceId]) {
      delete this.datasourceConfigs[datasourceId];
    }
    
    return initialLength !== this.datasources.length;
  }

  /**
   * Sets a property mapping for a specific datasource.
   * 
   * @param datasourceId - The ID of the datasource
   * @param mapping - The property mapping to set
   * @throws Error if the datasource doesn't have a configuration
   */
  setMapping(datasourceId: string, mapping: PropertyMapping): void {
    if (!this.datasourceConfigs[datasourceId]) {
      throw new Error(`Datasource '${datasourceId}' not found in linker. Cannot set mapping for unconfigured datasource.`);
    }
    
    this.datasourceConfigs[datasourceId].propertyMapping = mapping;
  }

  /**
   * Lists all available methods for a specific datasource.
   * 
   * @param datasourceId - The ID of the datasource
   * @returns Array of method names
   * @throws Error if the datasource is not found
   */
  listMethods(datasourceId: string): string[] {
    const datasource = this.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found in linker`);
    }

    return Object.keys(datasource.methods);
  }

  /**
   * Gets metadata information for a specific method of a datasource.
   * 
   * @param datasourceId - The ID of the datasource
   * @param methodName - The name of the method
   * @returns Method metadata if available, undefined otherwise
   * @throws Error if the datasource is not found
   */
  getMethodInfo(datasourceId: string, methodName: string): MethodMetadata | undefined {
    const datasource = this.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found in linker`);
    }

    // Check if method exists
    if (!datasource.methods[methodName]) {
      throw new Error(`Method '${methodName}' not found in datasource '${datasourceId}'`);
    }

    // Return metadata if available
    return datasource.methodsMetadata?.[methodName];
  }

  /**
   * Validates options against a method's schema if available.
   * 
   * @param datasourceId - The ID of the datasource
   * @param methodName - The name of the method
   * @param options - The options to validate
   * @returns Validation result with success flag and errors if any
   */
  validateMethodOptions(
    datasourceId: string,
    methodName: string,
    options: any
  ): { success: boolean; errors?: string[]; validatedData?: any } {
    const metadata = this.getMethodInfo(datasourceId, methodName);
    
    // If no metadata or schema, consider it valid (backwards compatibility)
    if (!metadata || !metadata.optionsSchema) {
      return { success: true, validatedData: options };
    }

    try {
      // Try to parse with Zod schema
      const validatedData = metadata.optionsSchema.parse(options);
      return { success: true, validatedData };
    } catch (error: any) {
      // Extract error messages from Zod validation error
      const errors: string[] = [];
      if (error.errors && Array.isArray(error.errors)) {
        error.errors.forEach((err: any) => {
          const path = err.path.join('.');
          errors.push(`${path ? path + ': ' : ''}${err.message}`);
        });
      } else {
        errors.push(error.message || 'Validation failed');
      }
      
      return { success: false, errors };
    }
  }

  /**
   * Gets all methods metadata for a datasource.
   * 
   * @param datasourceId - The ID of the datasource
   * @returns Record of method names to their metadata
   * @throws Error if the datasource is not found
   */
  getAllMethodsInfo(datasourceId: string): Record<string, MethodMetadata> {
    const datasource = this.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found in linker`);
    }

    return datasource.methodsMetadata || {};
  }
}
