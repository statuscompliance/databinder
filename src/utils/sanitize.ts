/**
 * Utilidades para sanitizar entradas externas para prevenir inyecciones y ataques
 */

/**
 * Sanitiza una cadena para uso seguro en URLs y rutas de archivo
 * Elimina caracteres especiales y secuencias potencialmente peligrosas
 * 
 * @param input - Cadena a sanitizar
 * @returns Cadena sanitizada
 */
export function sanitizeString(input: string): string {
  if (!input) return '';
  
  // Eliminar caracteres de control y secuencias de escape
  let sanitized = input.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
  
  // Eliminar caracteres peligrosos para inyección
  sanitized = sanitized.replace(/[;&<>"'`]/g, '');
  
  // Eliminar secuencias para traversal de directorios
  sanitized = sanitized.replace(/\.\.\//g, '');
  
  return sanitized;
}

/**
 * Sanitiza un valor para uso seguro en parámetros de consulta
 * 
 * @param value - Valor a sanitizar
 * @returns Valor sanitizado
 */
export function sanitizeQueryParam(value: string | number | boolean): string {
  if (typeof value === 'string') {
    return encodeURIComponent(sanitizeString(value));
  } else {
    return encodeURIComponent(String(value));
  }
}

/**
 * Sanitiza un objeto para uso seguro en URLs o archivos
 * Sanitiza recursivamente todas las propiedades de cadena
 * 
 * @param obj - Objeto a sanitizar
 * @returns Objeto con valores sanitizados
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeObject(value);
    } else {
      result[key] = value;
    }
  }
  
  return result as T;
}

/**
 * Sanitiza un nombre de archivo para uso seguro en el sistema de archivos
 * 
 * @param filename - Nombre de archivo a sanitizar
 * @returns Nombre de archivo sanitizado
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  // Eliminar caracteres no seguros para nombres de archivo
  const sanitized = filename.replace(/[\/\?<>\\:\*\|"]/g, '_');
  
  // Prevenir traversal de directorios
  return sanitized.replace(/^\.+/, '');
}

/**
 * Valida y sanitiza una URL
 * 
 * @param url - URL a validar y sanitizar
 * @returns URL sanitizada o vacía si es inválida
 */
export function sanitizeUrl(url: string): string {
  try {
    // Validar que es una URL bien formada
    const parsedUrl = new URL(url);
    
    // Permitir solo protocolos seguros
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return '';
    }
    
    return parsedUrl.toString();
  } catch (e) {
    // Si no es una URL válida, devolver cadena vacía
    return '';
  }
}
