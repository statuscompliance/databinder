export interface LogMetadata {  
  service?: string;  
  environment?: string;  
  host?: string;  
  pid?: number;  
  requestId?: string;  
  userId?: string;  
  ip?: string;  
  url?: string;  
  method?: string;  
  statusCode?: number;  
  stack?: string;  
  functionName?: string;  
  lineNumber?: number;  
  duration?: number;  
  userAgent?: string;  
  
  // Propiedades específicas de DataBinder
  datasourceId?: string;
  methodName?: string;
  step?: string;
  originalError?: any;
  options?: any;
  mapping?: any;
  batchIndex?: number;
  batchSize?: number;
  totalItems?: number;
  totalBatches?: number;
  itemCount?: number;
}  
  
export interface AuthOverride {  
  type?: string;  
  token?: string;  
  username?: string;  
  password?: string;  
  headerValue?: string;  
  cookies?: Record<string, string>;
}