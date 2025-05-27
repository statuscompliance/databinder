import { ClientSecretCredential } from '@azure/identity';

export async function getMicrosoftGraphToken({
  tenantId,
  clientId,
  clientSecret
}: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): Promise<string> {
  const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const token = await credential.getToken('https://graph.microsoft.com/.default');
  if (!token) throw new Error('Failed to acquire Microsoft Graph token');
  return token.token;
}
