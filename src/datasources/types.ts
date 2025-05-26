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
    totalItems?: number;
    totalPages?: number;
    currentPage?: number;
    hasNextPage: boolean;
  };
}

export interface DatasourceResponse<T = any> {
  data: T;
  metadata?: {
    timestamp: number;
    source: string;
    [key: string]: any;
  };
}

export type ResponseFormat = 'full' | 'iterator' | 'stream';
