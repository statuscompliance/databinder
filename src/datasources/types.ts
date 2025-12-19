export type DatasourceConfig = Record<string, any>

/**
 * Metadata information for a datasource method
 */
export interface MethodMetadata {
  /** Method name */
  name: string;
  /** Description of what the method does */
  description?: string;
  /** Zod schema for validating method options (stored as any for flexibility) */
  optionsSchema?: any;
  /** List of required option names */
  requiredOptions?: string[];
  /** Example usages of the method */
  examples?: Array<{
    description: string;
    options: any;
  }>;
  /** Return type description */
  returns?: string;
}

export interface Datasource {
  id: string;
  definitionId?: string; // ID of the definition used to create this instance
  config: DatasourceConfig;
  methods: {
    [key: string]: (options?: any) => Promise<any>;
  };
  /** Optional metadata about available methods */
  methodsMetadata?: Record<string, MethodMetadata>;
  
  // Utility methods for introspection
  /** Lists all available method names */
  listMethods?: () => string[];
  /** Gets metadata for a specific method */
  getMethodInfo?: (methodName: string) => MethodMetadata | undefined;
  /** Gets metadata for all methods */
  getAllMethodsInfo?: () => Record<string, MethodMetadata>;
}


export interface PaginationOptions {
  enabled: boolean;
  pageSize?: number;
  startPage?: number;
}

export interface QueryOptions {
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
}

export interface DatasourceMethodOptions {
  pagination?: PaginationOptions;
  query?: QueryOptions;
  batchSize?: number;
  // Allow additional properties for datasource-specific options
  [key: string]: any;
}

export interface DatasourceMethod {
  (options?: DatasourceMethodOptions): Promise<any>;
}

export interface DatasourceDefinitionConfig extends DatasourceConfig {
}

export interface DatasourceDefinition {
  id: string;
  name: string;
  description?: string;
  configSchema?: Record<string, any>;
  createInstance: (config: DatasourceConfig) => Datasource;
}

export interface BatchResponse<T> {
  data: T[];
  metadata: {
    currentPage?: number;
    totalPages?: number;
    hasNextPage: boolean;
    totalItems?: number;
    error?: string; // Añadimos la propiedad error para los casos de error
  };
}

export interface SourceResponse<T = any> {
  timestamp: number;
  source: string;
  [key: string]: any;
}

export type ResponseFormat = 'full' | 'iterator' | 'stream';

export interface SerializedDatasourceInstance {
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

export interface DatabaseAdapter {
  save(instances: SerializedDatasourceInstance[]): Promise<void>;
  load(): Promise<SerializedDatasourceInstance[]>;
  saveOne?(instance: SerializedDatasourceInstance): Promise<void>;
  loadOne?(id: string): Promise<SerializedDatasourceInstance | null>;
}
