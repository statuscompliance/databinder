import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  TraceFlags,
  metrics,
  ValueType,
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  ROOT_CONTEXT,
  createTraceState,
  TraceState,
} from '@opentelemetry/api';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// Exportar SpanKind para uso en otros módulos
export { SpanKind };

// Configurar el nivel de diagnóstico basado en la variable de entorno
diag.setLogger(
  new DiagConsoleLogger(),
  DiagLogLevel[
    (process.env.OTEL_LOG_LEVEL || 'INFO').toUpperCase() as keyof typeof DiagLogLevel
  ]
);

// Nombre del servicio para telemetría
const serviceName = process.env.SERVICE_NAME || 'databinder';

// Tracer para crear spans
const tracer = trace.getTracer(serviceName);

// Contadores para métricas básicas
const requestCounter = metrics.getMeter(serviceName).createCounter('databinder.requests.total', {
  description: 'Total number of requests',
  valueType: ValueType.INT,
});

const errorCounter = metrics.getMeter(serviceName).createCounter('databinder.requests.errors', {
  description: 'Total number of failed requests',
  valueType: ValueType.INT,
});

const successCounter = metrics.getMeter(serviceName).createCounter('databinder.requests.success', {
  description: 'Total number of successful requests',
  valueType: ValueType.INT,
});

// Histograma para latencia
const latencyHistogram = metrics.getMeter(serviceName).createHistogram('databinder.requests.duration', {
  description: 'Request duration in milliseconds',
  unit: 'ms',
  valueType: ValueType.DOUBLE,
});

// Variable para mantener el contexto raíz con un ID de traza válido
let rootContext = ROOT_CONTEXT;

// Inicializar el contexto raíz con un ID de traza válido (16 bytes hexadecimal)
function initializeRootContext() {
  // Generar un ID de traza único (32 caracteres hexadecimales = 16 bytes)
  const traceId = randomUUID().replace(/-/g, '');
  // Generar un ID de span inicial (16 caracteres hexadecimales = 8 bytes)
  const spanId = traceId.substring(0, 16);
  
  // Crear un estado de traza vacío
  const traceState = createTraceState('');
  
  // Crear un contexto de span con los IDs generados
  const spanContext = {
    traceId,
    spanId,
    traceFlags: TraceFlags.SAMPLED,
    isRemote: false,
    traceState
  };
  
  // Establecer el contexto raíz con el nuevo contexto de span
  rootContext = trace.setSpanContext(ROOT_CONTEXT, spanContext);
  
  return { traceId, spanId };
}

// Inicializar el contexto raíz al cargar el módulo
const { traceId: rootTraceId } = initializeRootContext();
console.log(`[Telemetry] Initialized root trace context with ID: ${rootTraceId}`);

/**
 * Crea un nuevo span para una operación
 * 
 * @param name - Nombre de la operación
 * @param options - Opciones adicionales para el span
 * @returns El span creado
 */
export function createSpan(name: string, options?: {
  kind?: SpanKind,
  attributes?: Record<string, any>,
  parent?: Span
}): Span {
  // Usar el contexto actual o el rootContext si no hay un contexto activo
  const currentContext = context.active() || rootContext;
  
  // Crear un nuevo span
  return tracer.startSpan(
    name, 
    {
      kind: options?.kind || SpanKind.INTERNAL,
      attributes: options?.attributes
    },
    currentContext
  );
}

/**
 * Ejecuta una función dentro de un span
 * 
 * @param name - Nombre del span
 * @param fn - Función a ejecutar
 * @param options - Opciones para el span
 * @returns El resultado de la función
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  options?: {
    kind?: SpanKind,
    attributes?: Record<string, any>
  }
): Promise<T> {
  const span = createSpan(name, options);
  const startTime = Date.now();
  
  try {
    // Incrementar contador de solicitudes
    requestCounter.add(1, {
      operation: name,
      ...options?.attributes
    });
    
    // Ejecutar función dentro del contexto del span
    const result = await context.with(trace.setSpan(context.active() || rootContext, span), 
      () => fn(span));
    
    // Marcar span como exitoso
    span.setStatus({ code: SpanStatusCode.OK });
    
    // Incrementar contador de éxitos
    successCounter.add(1, {
      operation: name,
      ...options?.attributes
    });
    
    return result;
  } catch (error) {
    // Registrar error en el span
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error)
    });
    
    // Registrar atributos de error
    span.recordException(error instanceof Error ? error : new Error(String(error)));
    
    // Incrementar contador de errores
    errorCounter.add(1, {
      operation: name,
      error: error instanceof Error ? error.name : 'unknown',
      ...options?.attributes
    });
    
    throw error;
  } finally {
    // Registrar duración
    const duration = Date.now() - startTime;
    latencyHistogram.record(duration, {
      operation: name,
      ...options?.attributes
    });
    
    // Finalizar span
    span.end();
  }
}

/**
 * Obtiene el contexto de trazado actual para registros y propagación
 * 
 * @returns Información del contexto de trazado actual
 */
export function getCurrentTraceContext(): {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
} {
  // Obtener el span activo o usar el contexto raíz si no hay span activo
  const currentSpan = trace.getSpan(context.active() || rootContext);
  if (!currentSpan) {
    // Si no hay span activo, obtener el contexto del rootContext
    const rootSpanContext = trace.getSpanContext(rootContext);
    if (!rootSpanContext) {
      // Si tampoco hay rootContext, generar nuevos IDs
      const { traceId, spanId } = initializeRootContext();
      return {
        traceId,
        spanId,
        traceFlags: TraceFlags.SAMPLED
      };
    }
    return {
      traceId: rootSpanContext.traceId,
      spanId: rootSpanContext.spanId,
      traceFlags: rootSpanContext.traceFlags
    };
  }
  
  const spanContext = currentSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags
  };
}

/**
 * Registra métricas de operación manualmente
 * 
 * @param name - Nombre de la operación
 * @param success - Si la operación fue exitosa
 * @param duration - Duración en ms
 * @param attributes - Atributos adicionales
 */
export function recordOperation(
  name: string,
  success: boolean,
  duration: number,
  attributes?: Record<string, any>
): void {
  // Incrementar contador de solicitudes
  requestCounter.add(1, {
    operation: name,
    ...attributes
  });
  
  // Incrementar contador de éxito/error
  if (success) {
    successCounter.add(1, {
      operation: name,
      ...attributes
    });
  } else {
    errorCounter.add(1, {
      operation: name,
      ...attributes
    });
  }
  
  // Registrar latencia
  latencyHistogram.record(duration, {
    operation: name,
    ...attributes
  });
}

/**
 * Obtiene métricas de telemetría actuales
 * 
 * @returns Métricas básicas del sistema
 */
export function getMetrics(): {
  requests: { total: number; success: number; errors: number };
  latency: { avg: number; p95: number; p99: number };
} {
  // Esta es una implementación básica, en un sistema real
  // deberías consultar los datos desde el colector de métricas
  return {
    requests: {
      total: 0, // Placeholder - en implementación real esto vendría del sistema de métricas
      success: 0,
      errors: 0
    },
    latency: {
      avg: 0,
      p95: 0,
      p99: 0
    }
  };
}

export default {
  tracer,
  createSpan,
  withSpan,
  getCurrentTraceContext,
  recordOperation,
  getMetrics
};
