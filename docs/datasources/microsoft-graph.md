# Microsoft Graph Datasource

A datasource for Microsoft Graph API to access Microsoft 365 services including Azure AD, Outlook, OneDrive, SharePoint, and more.

## Configuration

```typescript
interface MicrosoftGraphConfig extends DatasourceConfig {
  tenantId: string;              // Azure AD tenant ID
  clientId: string;              // Application client ID
  clientSecret: string;          // Application client secret
  scopes?: string[];             // OAuth scopes (defaults to ['.default'])
}
```

## Usage Example

```typescript
import { DatasourceCatalog } from '@statuscompliance/databinder';
import { MicrosoftGraphDatasource } from '@statuscompliance/databinder/datasources';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(MicrosoftGraphDatasource);

const graphApi = catalog.createDatasourceInstance('microsoft-graph', {
  tenantId: 'your-tenant-id',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  scopes: ['https://graph.microsoft.com/.default']
}, 'graph-instance');

const linker = new Linker({ datasources: [graphApi] });
const dataBinder = new DataBinder({ linker });
```

## Available Methods

### listSiteItems(options)
Lists items in a SharePoint site folder.

```typescript
const items = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'listSiteItems',
  siteId: 'contoso.sharepoint.com,site-guid,web-guid',
  folderPath: 'Documents/Reports'
});
```

### getSiteIdByPath(options)
Gets a SharePoint site ID by its path.

```typescript
const site = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'getSiteIdByPath',
  sitePath: 'contoso.sharepoint.com:/sites/TeamSite'
});

console.log('Site ID:', site.data.id);
```

## Common Operations

### Working with Users

```typescript
// List all users (requires User.Read.All permission)
const users = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users',
  query: {
    filters: {
      $filter: "startswith(displayName,'John')",
      $select: 'id,displayName,mail,userPrincipalName'
    }
  }
});

// Get specific user
const user = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users/user@domain.com'
});

// Get user's manager
const manager = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users/user@domain.com/manager'
});
```

### Working with Groups

```typescript
// List all groups
const groups = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/groups',
  query: {
    filters: {
      $filter: "groupTypes/any(c:c eq 'Unified')",  // Office 365 groups
      $select: 'id,displayName,description'
    }
  }
});

// Get group members
const members = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/groups/{group-id}/members'
});
```

### Working with Mail

```typescript
// List messages from inbox
const messages = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users/user@domain.com/messages',
  query: {
    filters: {
      $filter: "isRead eq false",
      $select: 'subject,from,receivedDateTime',
      $orderby: 'receivedDateTime desc',
      $top: 50
    }
  }
});

// Send an email
await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  method: 'POST',
  endpoint: '/users/user@domain.com/sendMail',
  body: {
    message: {
      subject: 'Hello from DataBinder',
      body: {
        contentType: 'HTML',
        content: '<h1>Hello</h1><p>This is a test email.</p>'
      },
      toRecipients: [
        {
          emailAddress: {
            address: 'recipient@domain.com'
          }
        }
      ]
    }
  }
});
```

### Working with OneDrive

```typescript
// List files in OneDrive
const files = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users/user@domain.com/drive/root/children'
});

// Upload a file
await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  method: 'PUT',
  endpoint: '/users/user@domain.com/drive/root:/Documents/test.txt:/content',
  body: 'File content here',
  headers: {
    'Content-Type': 'text/plain'
  }
});

// Download a file
const fileContent = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users/user@domain.com/drive/items/{item-id}/content'
});
```

### Working with SharePoint

```typescript
// Get site by path
const site = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'getSiteIdByPath',
  sitePath: 'contoso.sharepoint.com:/sites/TeamSite'
});

// List document libraries
const libraries = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: `/sites/${site.data.id}/drives`
});

// List files in a folder
const files = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'listSiteItems',
  siteId: site.data.id,
  folderPath: 'Shared Documents'
});
```

## Authentication

### App Registration

1. Register an app in [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** > **App registrations**
3. Create a new registration
4. Note the **Application (client) ID** and **Directory (tenant) ID**
5. Create a **Client secret** under **Certificates & secrets**

### Required Permissions

Configure API permissions in your app registration:

**Delegated permissions** (user context):
- `User.Read` - Read user profile
- `Mail.Read` - Read user mail
- `Files.Read.All` - Read all files
- `Sites.Read.All` - Read items in all site collections

**Application permissions** (app-only context):
- `User.Read.All` - Read all users
- `Group.Read.All` - Read all groups
- `Mail.Read` - Read mail in all mailboxes
- `Sites.Read.All` - Read all site collections

⚠️ Application permissions require admin consent.

## OData Query Parameters

Microsoft Graph supports OData query parameters:

```typescript
const users = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users',
  query: {
    filters: {
      $filter: "startswith(displayName,'A')",
      $select: 'id,displayName,mail',
      $orderby: 'displayName',
      $top: 100,
      $skip: 0
    }
  }
});
```

Common OData parameters:
- `$filter` - Filter results
- `$select` - Select specific properties
- `$orderby` - Sort results
- `$top` - Limit number of results
- `$skip` - Skip number of results
- `$expand` - Expand related entities
- `$count` - Include count of results

## Pagination

Microsoft Graph uses `@odata.nextLink` for pagination:

```typescript
let allUsers = [];
let endpoint = '/users';

while (endpoint) {
  const response = await dataBinder.fetchFromDatasource('graph-instance', {
    methodName: 'default',
    endpoint,
    responseOptions: { fullResponse: true }
  });

  allUsers.push(...response.data.value);
  endpoint = response.data['@odata.nextLink'] 
    ? response.data['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
    : null;
}
```

## Batch Requests

Execute multiple requests in a single call:

```typescript
const batchResponse = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  method: 'POST',
  endpoint: '/$batch',
  body: {
    requests: [
      {
        id: '1',
        method: 'GET',
        url: '/users/user1@domain.com'
      },
      {
        id: '2',
        method: 'GET',
        url: '/users/user2@domain.com'
      }
    ]
  }
});
```

## Error Handling

```typescript
try {
  const user = await dataBinder.fetchFromDatasource('graph-instance', {
    methodName: 'default',
    endpoint: '/users/nonexistent@domain.com'
  });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('User not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Authentication failed - check credentials and permissions');
  }
}
```

## Rate Limiting

Microsoft Graph implements throttling:
- Most requests: **2,000 requests per second per tenant**
- Per user: **120 requests per second**

The datasource includes automatic retry with exponential backoff for throttled requests.

## Best Practices

1. **Use service principals** for automated scenarios
2. **Request minimal permissions** (principle of least privilege)
3. **Use $select** to request only needed properties
4. **Implement pagination** for large result sets
5. **Use batch requests** to reduce network calls
6. **Cache responses** when appropriate
7. **Handle throttling** with retry logic
8. **Monitor token expiration** (tokens expire after 1 hour)

## Examples

### Get User Calendar Events

```typescript
const events = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/users/user@domain.com/calendar/events',
  query: {
    filters: {
      $filter: "start/dateTime ge '2024-01-01T00:00:00Z'",
      $select: 'subject,start,end,attendees',
      $orderby: 'start/dateTime'
    }
  }
});
```

### Create a Team

```typescript
const team = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  method: 'POST',
  endpoint: '/teams',
  body: {
    'template@odata.bind': "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
    displayName: 'My New Team',
    description: 'Team description',
    members: [
      {
        '@odata.type': '#microsoft.graph.aadUserConversationMember',
        roles: ['owner'],
        'user@odata.bind': "https://graph.microsoft.com/v1.0/users('user-id')"
      }
    ]
  }
});
```

### Search for Files

```typescript
const searchResults = await dataBinder.fetchFromDatasource('graph-instance', {
  methodName: 'default',
  endpoint: '/search/query',
  method: 'POST',
  body: {
    requests: [
      {
        entityTypes: ['driveItem'],
        query: {
          queryString: 'budget report'
        }
      }
    ]
  }
});
```

## API Documentation

For more details on Microsoft Graph API:
- [Microsoft Graph Documentation](https://learn.microsoft.com/en-us/graph/)
- [API Reference](https://learn.microsoft.com/en-us/graph/api/overview)
- [Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Throttling Guidance](https://learn.microsoft.com/en-us/graph/throttling)
