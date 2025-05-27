import { z } from 'zod';
import { AuthOverride } from './types';

/**
 * Esquema para validar información de autenticación
 */
export const authOverrideSchema = z.object({
  type: z.string().optional(),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  headerValue: z.string().optional(),
  cookies: z.record(z.string()).optional()
});

/**
 * Esquema para validar opciones básicas de fetch
 */
export const baseFetchOptionsSchema = z.object({
  responseFormat: z.enum(['full', 'batch', 'iterator', 'stream']).optional(),
  datasourceIds: z.array(z.string()).optional(),
  batchSize: z.number().positive().optional(),
  headers: z.record(z.string()).optional(),
  cookies: z.record(z.string()).optional(),
  authOverride: authOverrideSchema.optional(),
  endpoint: z.string().optional(),
  methodName: z.string().optional(),
  responseOptions: z.object({
    fullResponse: z.boolean().optional(),
    throwHttpErrors: z.boolean().optional()
  }).optional(),
  pagination: z.object({
    enabled: z.boolean().optional(),
    startPage: z.number().optional(),
    pageSize: z.number().optional()
  }).optional(),
  query: z.object({
    filters: z.record(z.any()).optional(),
    sort: z.array(z.object({
      field: z.string(),
      direction: z.enum(['asc', 'desc'])
    })).optional()
  }).optional(),
});

/**
 * Esquema para validar configuración de API REST
 */
export const restApiConfigSchema = z.object({
  baseUrl: z.string().url(),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
  endpoints: z.record(z.string()).optional(),
  defaultEndpoint: z.string().optional(),
  auth: z.object({
    type: z.enum(['cookie', 'bearer', 'basic', 'custom']),
    cookies: z.record(z.string()).optional(),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headerName: z.string().optional(),
    headerValue: z.string().optional()
  }).optional(),
  requestOptions: z.any().optional()
});

/**
 * Esquema para validar opciones del método Rest API
 */
export const restApiMethodOptionsSchema = z.object({
  headers: z.record(z.string()).optional(),
  cookies: z.record(z.string()).optional(),
  authOverride: z.object({
    type: z.enum(['cookie', 'bearer', 'basic', 'custom']).optional(),
    token: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    headerValue: z.string().optional(),
    cookies: z.record(z.string()).optional()
  }).optional(),
  endpoint: z.string().optional(),
  responseOptions: z.object({
    fullResponse: z.boolean().optional(),
    throwHttpErrors: z.boolean().optional()
  }).optional(),
  responseFormat: z.enum(['full', 'batch', 'iterator', 'stream']).optional(),
  retryOptions: z.object({
    maxRetries: z.number().nonnegative().optional(),
    baseDelay: z.number().nonnegative().optional(),
    exponential: z.boolean().optional()
  }).optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).optional(),
  body: z.any().optional()
});

/**
 * Función para validar entrada de configuración
 * @param data - Datos a validar
 * @param schema - Esquema de validación
 * @returns Datos validados y tipados
 * @throws Error si la validación falla
 */
export function validateInput<T>(data: unknown, schema: z.ZodSchema<T>): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const { InvalidConfigError } = require('../core/errors');
      
      // Agrupar errores por path para mejor legibilidad
      const issues = error.issues.map(issue => {
        const path = issue.path.join('.');
        return `'${path}': ${issue.message}`;
      }).join('; ');
      
      // Obtener el primer error para información adicional
      const firstIssue = error.issues[0];
      const propertyName = firstIssue?.path.join('.');
      
      // Extraer información de tipo esperado del mensaje
      // Zod no proporciona expected/received directamente
      let expectedType: string | undefined;
      let receivedValue: any = undefined;
      
      if (firstIssue?.code === 'invalid_type') {
        expectedType = (firstIssue as z.ZodInvalidTypeIssue).expected;
        receivedValue = (firstIssue as z.ZodInvalidTypeIssue).received;
      }
      
      throw new InvalidConfigError(
        `Validation failed: ${issues}`,
        propertyName,
        expectedType,
        receivedValue
      );
    }
    throw error;
  }
}
