import { Datasource, DatasourceMethodOptions } from '../datasources/types';

export interface PropertyMapping {
  [originalProp: string]: string;
}

export interface DatasourceMethodConfig {
  methodName: string;
  options?: DatasourceMethodOptions;
}

export interface DatasourceConfig {
  id: string;
  methodConfig?: DatasourceMethodConfig;
  propertyMapping?: PropertyMapping;
}

export interface LinkerOptions {
  datasources: Datasource[];
  datasourceConfigs?: Record<string, DatasourceConfig>;
  defaultMethodName?: string;
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
   */
  constructor(options: LinkerOptions) {
    this.datasources = options.datasources;
    this.datasourceConfigs = options.datasourceConfigs || {};
    this.defaultMethodName = options.defaultMethodName || 'default';
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
   * Gets the method to call for a specific datasource.
   * 
   * @param datasourceId - The ID of the datasource
   * @param methodName - Optional name of the method to use (overrides config and default)
   * @returns An object containing the method, method name, and options
   * @throws Error if the datasource or method is not found
   */
  getMethodForDatasource(datasourceId: string, methodName?: string): {
    method: (...args: any[]) => Promise<any>;
    methodName: string;
    options?: DatasourceMethodOptions;
  } {
    const datasource = this.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found in linker`);
    }

    const config = this.datasourceConfigs[datasourceId];
    // Usamos el methodName proporcionado, o el de la configuración, o el predeterminado
    const finalMethodName = methodName || config?.methodConfig?.methodName || this.defaultMethodName;
    const method = datasource.methods[finalMethodName];
    
    if (!method) {
      throw new Error(`Method '${finalMethodName}' not found in datasource '${datasourceId}'`);
    }

    return {
      method,
      methodName: finalMethodName,
      options: config?.methodConfig?.options
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
   * Adds a datasource to the linker with optional configuration.
   * 
   * @param datasource - The datasource to add
   * @param config - Optional configuration for the datasource
   * @throws Error if a datasource with the same ID already exists
   */
  addDatasource(datasource: Datasource, config?: DatasourceConfig): void {
    if (this.datasources.some(ds => ds.id === datasource.id)) {
      throw new Error(`Datasource with ID '${datasource.id}' already exists in linker`);
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
   */
  setMapping(datasourceId: string, mapping: PropertyMapping): void {
    if (!this.datasourceConfigs[datasourceId]) {
      this.datasourceConfigs[datasourceId] = { id: datasourceId };
    }
    
    this.datasourceConfigs[datasourceId].propertyMapping = mapping;
  }
}
