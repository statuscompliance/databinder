# Utilities

DataBinder provides several utility modules for validation, sanitization, logging, retry logic, and telemetry.

## Validation

The validation module provides Zod-based schemas and utilities for input validation.

### Available Functions

#### validateInput(input, schema)

Validates input against a Zod schema and returns the validated data.

```typescript
import { validateInput } from '@statuscompliance/databinder';
import { z } from 'zod';

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().min(0).max(120)
});

try {
  const validatedUser = validateInput(userData, userSchema);
  // Use validatedUser - it's now type-safe
} catch (error) {
  // Handle validation error
  console.error('Validation failed:', error.message);
}
```

### Built-in Schemas

#### authOverrideSchema
Validates authentication override options.

```typescript
const authData = validateInput(authOptions, authOverrideSchema);
```

#### baseFetchOptionsSchema
Validates base fetch options used across datasources.

```typescript
const fetchOptions = validateInput(options, baseFetchOptionsSchema);
```

#### paginationOptionsSchema
Validates pagination configuration.

```typescript
const paginationConfig = validateInput(paginationOptions, paginationOptionsSchema);
```

#### queryOptionsSchema
Validates query options including filters and sorting.

```typescript
const queryConfig = validateInput(queryOptions, queryOptionsSchema);
```

### Custom Validation

You can create custom validators for your datasources:

```typescript
import { z } from 'zod';
import { validateInput } from '@statuscompliance/databinder';

const customConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url('Must be a valid URL'),
  timeout: z.number().min(1000).max(60000).optional(),
  retryAttempts: z.number().min(0).max(5).default(3)
});

// Use in your datasource
const validatedConfig = validateInput(config, customConfigSchema);
```

## Sanitization

The sanitization module provides functions to clean user input and prevent injection attacks.

### Available Functions

#### sanitizeString(input)

Sanitizes strings for safe use in URLs and file paths.

```typescript
import { sanitizeString } from '@statuscompliance/databinder';

const userInput = "user input with <script>alert('xss')</script>";
const safe = sanitizeString(userInput);
// Result: "user input with scriptalert('xss')/script"
```

#### sanitizeFilename(filename)

Sanitizes filenames for safe file system operations.

```typescript
import { sanitizeFilename } from '@statuscompliance/databinder';

const filename = "../../../etc/passwd";
const safeFilename = sanitizeFilename(filename);
// Result: "etcpasswd"
```

#### sanitizePath(path)

Sanitizes file paths to prevent directory traversal attacks.

```typescript
import { sanitizePath } from '@statuscompliance/databinder';

const userPath = "/safe/path/../../../etc/passwd";
const safePath = sanitizePath(userPath);
// Result: "/safe/path/etc/passwd" (traversal attempts removed)
```

#### sanitizeUrl(url)

Sanitizes URLs to prevent malicious redirects.

```typescript
import { sanitizeUrl } from '@statuscompliance/databinder';

const userUrl = "javascript:alert('xss')";
const safeUrl = sanitizeUrl(userUrl);
// Result: "about:blank" (dangerous protocols blocked)
```

### Usage in Datasources

All built-in datasources automatically sanitize inputs:

```typescript
// Datasource internally sanitizes the ID
const datasource = catalog.getDatasourceInstance(userProvidedId);

// URLs and paths are sanitized in REST API calls
const result = await dataBinder.fetchFromDatasource('api', {
  endpoint: userProvidedEndpoint  // Automatically sanitized
});
```

## Logging

Structured logging with configurable levels and output formats.

### Basic Usage

```typescript
import { logger } from '@statuscompliance/databinder';

logger.info('Application started', { version: '1.0.0' });
logger.warn('Deprecated feature used', { feature: 'oldMethod' });
logger.error('Request failed', { error: error.message, statusCode: 500 });
logger.debug('Debug information', { debugData });
```

### Error Logging

```typescript
import { logError } from '@statuscompliance/databinder';

try {
  // Some operation
} catch (error) {
  logError(error, {
    operation: 'fetchData',
    datasourceId: 'api-1',
    additionalContext: 'Custom context'
  });
}
```

### Configuration

Configure logging behavior via environment variables:

```bash
# Log level (error, warn, info, debug)
LOG_LEVEL=info

# Log format (json, simple)
LOG_FORMAT=json

# Enable/disable console output
LOG_CONSOLE=true

# Log file path (optional)
LOG_FILE=./logs/databinder.log
```

## Retry Logic

Automatic retry functionality with exponential backoff for handling transient failures.

### withRetry Function

```typescript
import { withRetry } from '@statuscompliance/databinder';

const result = await withRetry(
  async () => {
    // Operation that might fail
    return await fetch('https://api.example.com/data');
  },
  {
    maxAttempts: 3,
    baseDelay: 1000,        // 1 second base delay
    maxDelay: 10000,        // Maximum 10 seconds
    backoffFactor: 2,       // Exponential backoff
    retryCondition: (error) => {
      // Retry on network errors and 5xx responses
      return error.name === 'NetworkError' || 
             (error.status >= 500 && error.status < 600);
    }
  }
);
```

### Default Retry Configuration

Built-in datasources use these default retry settings:

```typescript
{
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffFactor: 2,
  retryCondition: (error) => isRetryableError(error)
}
```

### Custom Retry Logic

Create custom retry configurations for specific use cases:

```typescript
import { withRetry, RetryOptions } from '@statuscompliance/databinder';

const customRetryConfig: RetryOptions = {
  maxAttempts: 5,
  baseDelay: 500,
  maxDelay: 15000,
  backoffFactor: 1.5,
  retryCondition: (error) => {
    // Only retry on timeout errors
    return error.name === 'TimeoutError';
  },
  onRetry: (error, attempt) => {
    console.log(`Retry attempt ${attempt} after error:`, error.message);
  }
};

const result = await withRetry(riskyOperation, customRetryConfig);
```

## Telemetry

OpenTelemetry integration for observability and monitoring.

### Automatic Instrumentation

DataBinder automatically creates spans for:

- DataBinder operations (`fetchAll`, `fetchFromDatasource`)
- Individual datasource method calls
- Network requests
- Database operations (when using persistence)

### Manual Instrumentation

Add custom spans to your code:

```typescript
import { withSpan, SpanKind } from '@statuscompliance/databinder';

const result = await withSpan('custom-operation', async (span) => {
  span.setAttribute('operation.type', 'data-processing');
  span.setAttribute('items.count', items.length);
  
  // Your operation
  const processed = processData(items);
  
  span.setAttribute('processed.count', processed.length);
  return processed;
}, {
  kind: SpanKind.INTERNAL,
  attributes: {
    'service.name': 'my-service'
  }
});
```

### Operation Recording

Record custom metrics:

```typescript
import { recordOperation } from '@statuscompliance/databinder';

const startTime = Date.now();
let success = false;

try {
  await performOperation();
  success = true;
} catch (error) {
  // Handle error
} finally {
  const duration = Date.now() - startTime;
  recordOperation('custom-operation', success, duration, {
    operationType: 'data-fetch',
    itemCount: 100
  });
}
```

### Configuration

Configure telemetry via environment variables:

```bash
# Enable/disable telemetry
OTEL_SDK_DISABLED=false

# Service name
OTEL_SERVICE_NAME=databinder-app

# Exporter type (console, jaeger, otlp)
OTEL_EXPORTER_TYPE=console

# Sampling rate (0.0 to 1.0)
OTEL_SAMPLING_RATIO=1.0
```

## Type Definitions

Common utility types used throughout DataBinder.

### AuthOverride

```typescript
interface AuthOverride {
  type?: string;
  token?: string;
  username?: string;
  password?: string;
  headerValue?: string;
  cookies?: Record<string, string>;
}
```

### RetryOptions

```typescript
interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: Error) => boolean;
  onRetry?: (error: Error, attempt: number) => void;
}
```

### SpanOptions

```typescript
interface SpanOptions {
  kind?: SpanKind;
  attributes?: Record<string, string | number | boolean>;
}
```

## Best Practices

### Validation
- Always validate external input using provided schemas
- Create custom schemas for domain-specific validation
- Use type-safe validation to catch errors early

### Sanitization
- Sanitize all user-provided strings before use
- Be especially careful with file paths and URLs
- Use appropriate sanitization functions for the context

### Logging
- Use structured logging with context objects
- Include relevant identifiers in log messages
- Use appropriate log levels (debug for development, info for important events)

### Retry Logic
- Use retry logic for network operations and external API calls
- Configure retry conditions based on error types
- Set reasonable limits to avoid infinite retry loops

### Telemetry
- Use telemetry for monitoring and debugging
- Add relevant attributes to spans
- Configure sampling for production environments