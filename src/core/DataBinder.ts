import { Linker } from './Linker';
import { BatchResponse, DatasourceMethodOptions, ResponseFormat } from '../datasources/types';

export interface DataBinderOptions {
  linker: Linker;
  responseFormat?: ResponseFormat;
  defaultBatchSize?: number;
}

// Base properties that are always available in FetchOptions
export interface BaseFetchOptions extends DatasourceMethodOptions {
  responseFormat?: ResponseFormat;
  datasourceIds?: string[];
  batchSize?: number;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  authOverride?: {
    type?: string;
    token?: string;
    username?: string;
    password?: string;
    headerValue?: string;
    cookies?: Record<string, string>;
  };
  endpoint?: string;
  methodName?: string;
  responseOptions?: {
    fullResponse?: boolean;
    throwHttpErrors?: boolean;
  };
}

// FetchOptions extends BaseFetchOptions and allows additional properties of any type
// This will allow passing specific properties to concrete methods
export type FetchOptions = BaseFetchOptions & Record<string, any>;

/**
 * Main class for binding and fetching data from multiple datasources.
 * Provides methods to fetch data with various formats and options.
 */
export class DataBinder {
  private linker: Linker;
  private responseFormat: ResponseFormat;
  private defaultBatchSize: number;

  /**
   * Creates a new DataBinder instance.
   * 
   * @param options - Configuration options for the DataBinder
   */
  constructor(options: DataBinderOptions) {
    this.linker = options.linker;
    this.responseFormat = options.responseFormat || 'full';
    this.defaultBatchSize = options.defaultBatchSize || 100;
  }

  /**
   * Fetches data from all configured datasources or a specific subset.
   * 
   * @param options - Options for fetching data
   * @returns A promise that resolves to the fetched data
   */
  async fetchAll(options?: FetchOptions): Promise<any> {
    const format = options?.responseFormat || this.responseFormat;
    const datasourceIds = options?.datasourceIds || this.linker.datasources.map(ds => ds.id);
    
    if (format === 'iterator') {
      return this.createResultIterator(datasourceIds, options?.batchSize, options);
    }
    
    const results: Record<string, any> = {};

    for (const dsId of datasourceIds) {
      const result = await this.fetchFromDatasource(dsId, options || {});
      results[dsId] = result;
    }

    return results;
  }

  /**
   * Fetches data from a specific datasource
   * 
   * @param datasourceId - ID of the datasource to fetch from
   * @param options - Options for the fetch operation
   * @returns The fetched data
   * @throws Error if the datasource is not found or fetching fails
   */
  async fetchFromDatasource(datasourceId: string, options: FetchOptions): Promise<any> {
    const datasource = this.linker.getDatasource(datasourceId);
    if (!datasource) {
      throw new Error(`Datasource with ID '${datasourceId}' not found`);
    }

    const methodName = options.methodName || 'default';
    if (typeof datasource.methods[methodName] !== 'function') {
      throw new Error(`Method '${methodName}' not found in datasource '${datasourceId}'`);
    }

    try {
      // Ensure we pass the datasource configuration
      const fetchOptions = {
        ...options,
        config: datasource.config // Add the configuration here
      };
      return await datasource.methods[methodName](fetchOptions);
    } catch (error) {
      throw new Error(`Error fetching from datasource '${datasourceId}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Applies property mapping to the data.
   * 
   * @param data - The data to apply mapping to
   * @param mapping - The property mapping to apply
   * @returns The mapped data
   */
  private applyMapping(data: any, mapping: Record<string, string>): any {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    const remapped: any = {};
    for (const key in data) {
      const newKey = mapping[key] || key;
      remapped[newKey] = data[key];
    }
    return remapped;
  }

  /**
   * Creates an async iterator for fetching data in batches.
   * First fetches all data and then splits it into batches for processing.
   * 
   * @param datasourceIds - The IDs of the datasources to fetch from
   * @param batchSize - The number of items to fetch in each batch
   * @param parentOptions - Additional options for fetching data
   * @returns An async iterator that yields batches of data
   */
  private async *createResultIterator(
    datasourceIds: string[], 
    batchSize = this.defaultBatchSize,
    parentOptions?: FetchOptions
  ): AsyncGenerator<BatchResponse<any>, void, unknown> {
    for (const dsId of datasourceIds) {
      const { method, options: methodOptions } = this.linker.getMethodForDatasource(dsId);
      const mapping = this.linker.getMappingForDatasource(dsId);
      
      try {
        // Fetch all data at once with no pagination to get complete dataset
        const options: any = {
          ...methodOptions,
          ...parentOptions,
          pagination: {
            enabled: false
          }
        };
        
        console.log(`Fetching all data from datasource ${dsId}...`);
        const response = await method(options);
        
        let allData = response.data || response;
        if (!Array.isArray(allData)) {
          allData = [allData];
        }
        
        console.log(`Received ${allData.length} total items from datasource ${dsId}`);
        
        // Apply mapping if needed - with explicit type for item
        if (mapping) {
          allData = allData.map((item: any) => this.applyMapping(item, mapping));
        }
        
        // Split the data into batches
        const totalItems = allData.length;
        const totalBatches = Math.ceil(totalItems / batchSize);
        
        console.log(`Splitting data into ${totalBatches} batches of size ${batchSize}`);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * batchSize;
          const end = Math.min(start + batchSize, totalItems);
          const batchData = allData.slice(start, end);
          
          // First create an object that complies with BatchResponse
          const batchResponse: BatchResponse<any> = {
            data: batchData,
            metadata: {
              currentPage: batchIndex + 1,
              totalPages: totalBatches,
              hasNextPage: batchIndex < totalBatches - 1,
              totalItems: totalItems
            }
          };
          
          // Then add additional properties using type assertion
          (batchResponse.metadata as any).batchIndex = batchIndex;
          (batchResponse.metadata as any).batchSize = batchSize;
          
          yield batchResponse;
        }
        
      } catch (error) {
        console.error(`Error fetching data from datasource ${dsId}:`, error);
        // Yield an empty batch with error information
        const errorBatch: BatchResponse<any> = {
          data: [],
          metadata: {
            currentPage: 1,
            totalPages: 1,
            hasNextPage: false
          }
        };
        
        yield errorBatch;
      }
    }
  }
}
