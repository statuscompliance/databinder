export type DatasourceConfig = Record<string, any>

export interface Datasource {
  id: string;
  definitionId?: string; // ID of the definition used to create this instance
  config: DatasourceConfig;
  methods: {
    [key: string]: (options?: any) => Promise<any>;
  };
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
