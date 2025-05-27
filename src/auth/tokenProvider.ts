/**
 * Token provider for authentication with various services
 */
import { MicrosoftGraphConfig } from '../datasources/implementations/MicrosoftGraphDatasource';
import { AuthenticationError, NetworkError } from '../core/errors';
import { logger } from '../core/logger';
import { withRetry } from '../utils/retryUtils';

/**
 * Gets an authentication token for Microsoft Graph API
 * 
 * @param config - Microsoft Graph configuration with tenant ID, client ID, and client secret
 * @returns Promise that resolves to an access token
 * @throws AuthenticationError if token acquisition fails
 */
export async function getMicrosoftGraphToken(config: MicrosoftGraphConfig): Promise<string> {
  logger.debug('Acquiring Microsoft Graph token', { 
    tenantId: config.tenantId,
    clientId: config.clientId
  });
  
  const scopes = config.scopes || ['https://graph.microsoft.com/.default'];
  const scope = Array.isArray(scopes) ? scopes.join(' ') : scopes;
  
  const tokenEndpoint = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  
  // Use retry logic for token acquisition
  return withRetry(async () => {
    try {
      const params = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope,
        grant_type: 'client_credentials'
      });
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'unknown_error' }));
        
        logger.error('Microsoft Graph token acquisition failed', { 
          status: response.status,
          error: errorData.error,
          errorDescription: errorData.error_description
        });
        
        throw new AuthenticationError(
          `Failed to acquire Microsoft Graph token: ${errorData.error_description || response.statusText}`,
          'microsoft-graph',
          response.status,
          { error: errorData.error }
        );
      }
      
      const data = await response.json();
      
      if (!data.access_token) {
        throw new AuthenticationError(
          'Microsoft Graph token response did not contain an access token',
          'microsoft-graph'
        );
      }
      
      logger.debug('Successfully acquired Microsoft Graph token');
      
      return data.access_token;
    } catch (error) {
      // If it's already an AuthenticationError, just rethrow it
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      // Otherwise, convert to an appropriate error type
      if (error instanceof Error) {
        logger.error('Microsoft Graph token acquisition failed', { 
          error: error.message
        });
        
        throw new NetworkError(
          `Failed to acquire Microsoft Graph token: ${error.message}`,
          tokenEndpoint,
          'POST'
        );
      }
      
      throw new AuthenticationError(
        `Unknown error acquiring Microsoft Graph token: ${String(error)}`,
        'microsoft-graph'
      );
    }
  }, {
    maxRetries: 3,
    baseDelay: 1000,
    exponential: true
  });
}

// Add more token providers as needed for other services
