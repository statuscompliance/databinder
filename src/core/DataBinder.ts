import { Linker } from './Linker';
import { BatchResponse, DatasourceMethodOptions, ResponseFormat } from '../datasources/types';
import logger, { logError } from '../utils/logger';
import { withSpan, recordOperation, SpanKind } from '../utils/telemetry';

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
    logger.info('DataBinder initialized', { responseFormat: this.responseFormat, defaultBatchSize: this.defaultBatchSize });
  }

  /**
   * Fetches data from all configured datasources or a specific subset.
   * 
   * @param options - Options for fetching data
   * @returns A promise that resolves to the fetched data
   */
  async fetchAll(options?: FetchOptions): Promise<any> {
    return withSpan('DataBinder.fetchAll', async (span) => {
      const format = options?.responseFormat || this.responseFormat;
      interface Datasource {
        id: string;
      }

      const datasourceIds: string[] = options?.datasourceIds ||
        this.linker.datasources.map((ds: Datasource) => ds.id);
      
      span.setAttribute('databinder.datasources.count', datasourceIds.length);
      span.setAttribute('databinder.response_format', format);
      
      logger.info('Fetching data from datasources', { 
        datasourceIds, 
        format, 
        options
      });
      
      if (format === 'iterator') {
        return this.createResultIterator(datasourceIds, options?.batchSize, options);
      }
      
      const results: Record<string, any> = {};

      for (const dsId of datasourceIds) {
        logger.debug(`Fetching from datasource: ${dsId}`);
        
        // Crear child span para cada datasource
        const childResult = await withSpan(`DataBinder.fetchFromDatasource(${dsId})`, async () => {
          return this.fetchFromDatasource(dsId, options || {});
        }, {
          attributes: {
            'databinder.datasource.id': dsId
          }
        });
        
        results[dsId] = childResult;
      }

      logger.info('Data fetching completed', { datasourceCount: datasourceIds.length });
      return results;
    }, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'databinder.operation': 'fetchAll'
      }
    });
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
    const { validateInput, baseFetchOptionsSchema } = require('../utils/validation');
    const { sanitizeString } = require('../utils/sanitize');
    
    // Sanitize datasource ID
    const safeDataSourceId = sanitizeString(datasourceId);
    
    // Medición de tiempo
    const startTime = Date.now();
    let success = false;
    
    try {
      // Validate options
      const validatedOptions = validateInput(options, baseFetchOptionsSchema.passthrough());
      
      const datasource = this.linker.getDatasource(safeDataSourceId);
      if (!datasource) {
        const error = new Error(`Datasource with ID '${safeDataSourceId}' not found`);
        logError(error, { datasourceId: safeDataSourceId });
        throw error;
      }

      const methodName = validatedOptions.methodName || 'default';
      if (typeof datasource.methods[methodName] !== 'function') {
        const error = new Error(`Method '${methodName}' not found in datasource '${safeDataSourceId}'`);
        logError(error, { datasourceId: safeDataSourceId, methodName });
        throw error;
      }

      logger.debug(`Executing method '${methodName}' on datasource '${safeDataSourceId}'`, { 
        options: validatedOptions 
      });
      
      // Ensure we pass the datasource configuration and ID
      const fetchOptions = {
        ...validatedOptions,
        config: datasource.config,
        datasourceId: safeDataSourceId
      };
      
      const result = await datasource.methods[methodName](fetchOptions);
      success = true;
      return result;
    } catch (error) {
      const enhancedError = new Error(`Error fetching from datasource '${safeDataSourceId}': ${error instanceof Error ? error.message : String(error)}`);
      logError(enhancedError, { datasourceId: safeDataSourceId, methodName: options.methodName || 'default', originalError: error });
      throw enhancedError;
    } finally {
      // Registrar métricas de la operación
      const duration = Date.now() - startTime;
      recordOperation(
        'fetchFromDatasource',
        success,
        duration,
        {
          datasourceId: safeDataSourceId,
          methodName: options.methodName || 'default'
        }
      );
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
        
        logger.info(`Fetching all data from datasource ${dsId}...`, { dsId, options });
        const response = await method(options);
        
        let allData = response.data || response;
        if (!Array.isArray(allData)) {
          allData = [allData];
        }
        
        logger.info(`Received ${allData.length} total items from datasource ${dsId}`, { 
          datasourceId: dsId, 
          itemCount: allData.length 
        });
        
        // Apply mapping if needed - with explicit type for item
        if (mapping) {
          logger.debug(`Applying property mapping for datasource ${dsId}`, { mapping });
          allData = allData.map((item: any) => this.applyMapping(item, mapping));
        }
        
        // Split the data into batches
        const totalItems = allData.length;
        const totalBatches = Math.ceil(totalItems / batchSize);
        
        logger.info(`Splitting data into ${totalBatches} batches of size ${batchSize}`, {
          datasourceId: dsId,
          totalItems,
          totalBatches,
          batchSize
        });
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const start = batchIndex * batchSize;
          const end = Math.min(start + batchSize, totalItems);
          const batchData = allData.slice(start, end);
          
          logger.debug(`Yielding batch ${batchIndex + 1}/${totalBatches}`, {
            datasourceId: dsId,
            batchIndex,
            batchSize: batchData.length
          });
          
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
        const errorMessage = `Error fetching data from datasource ${dsId}`;
        logError(error instanceof Error ? error : new Error(String(error)), {
          datasourceId: dsId,
          step: 'createResultIterator'
        });
        
        // Yield an empty batch with error information
        const errorBatch: BatchResponse<any> = {
          data: [],
          metadata: {
            currentPage: 1,
            totalPages: 1,
            hasNextPage: false,
            error: error instanceof Error ? error.message : String(error)
          }
        };
        
        yield errorBatch;
      }
    }
  }
}
