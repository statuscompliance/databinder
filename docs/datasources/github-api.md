# GitHub API Datasource

A specialized datasource for the GitHub REST API with pre-configured methods for common GitHub operations.

## Configuration

```typescript
interface GithubApiConfig extends RestApiConfig {
  personalAccessToken?: string;    // GitHub Personal Access Token
  defaultOrg?: string;            // Default organization
  defaultRepo?: string;           // Default repository
  apiVersion?: string;            // API version (defaults to 'v3')
}
```

## Usage Example

```typescript
import { DatasourceCatalog } from '@statuscompliance/databinder';
import { GithubApiDatasource } from '@statuscompliance/databinder/datasources';

const catalog = new DatasourceCatalog();
catalog.registerDatasource(GithubApiDatasource);

const githubApi = catalog.createDatasourceInstance('github-api', {
  personalAccessToken: 'ghp_xxxxxxxxxxxx',
  defaultOrg: 'octocat',
  defaultRepo: 'Hello-World',
  apiVersion: 'v3'
}, 'github-instance');

const linker = new Linker({ datasources: [githubApi] });
const dataBinder = new DataBinder({ linker });
```

## Available Methods

### getUser(options)
Fetches user information.

```typescript
// Get authenticated user
const user = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getUser'
});

// Get specific user
const user = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getUser',
  username: 'octocat'
});
```

### getRepository(options)
Fetches repository information.

```typescript
const repo = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getRepository',
  owner: 'octocat',
  repo: 'Hello-World'
});
```

### getRepositories(options)
Fetches repositories for a user or organization.

```typescript
const repos = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getRepositories',
  owner: 'octocat',
  type: 'public',  // 'public', 'private', 'all'
  sort: 'updated',
  direction: 'desc',
  pagination: {
    enabled: true,
    pageSize: 30
  }
});
```

### getIssues(options)
Fetches issues from a repository.

```typescript
const issues = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getIssues',
  owner: 'octocat',
  repo: 'Hello-World',
  state: 'open',  // 'open', 'closed', 'all'
  labels: ['bug', 'help wanted'],
  sort: 'created',
  direction: 'desc'
});
```

### getIssue(options)
Fetches a specific issue.

```typescript
const issue = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getIssue',
  owner: 'octocat',
  repo: 'Hello-World',
  issueNumber: 42
});
```

### getPullRequests(options)
Fetches pull requests from a repository.

```typescript
const prs = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getPullRequests',
  owner: 'octocat',
  repo: 'Hello-World',
  state: 'open',
  sort: 'updated',
  direction: 'desc'
});
```

### getPullRequest(options)
Fetches a specific pull request.

```typescript
const pr = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getPullRequest',
  owner: 'octocat',
  repo: 'Hello-World',
  pullNumber: 123
});
```

### getContents(options)
Fetches file or directory contents from a repository.

```typescript
const content = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getContents',
  owner: 'octocat',
  repo: 'Hello-World',
  path: 'README.md',
  ref: 'main'  // optional branch/tag/commit
});
```

### searchCode(options)
Searches for code across GitHub.

```typescript
const results = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'searchCode',
  query: 'addClass in:file language:js repo:jquery/jquery'
});
```

### searchIssues(options)
Searches for issues and pull requests.

```typescript
const results = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'searchIssues',
  query: 'is:issue is:open label:bug repo:octocat/Hello-World'
});
```

## Advanced Features

### Using Default Organization/Repository

If you set `defaultOrg` and `defaultRepo` in the configuration, you can omit them from method calls:

```typescript
const githubApi = catalog.createDatasourceInstance('github-api', {
  personalAccessToken: 'ghp_xxxxxxxxxxxx',
  defaultOrg: 'octocat',
  defaultRepo: 'Hello-World'
}, 'github-instance');

// Now you can omit owner and repo
const issues = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getIssues',
  state: 'open'
});
```

### Pagination

GitHub API responses are automatically paginated:

```typescript
const repos = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getRepositories',
  owner: 'octocat',
  pagination: {
    enabled: true,
    pageSize: 100,  // Max is 100 for GitHub API
    startPage: 1
  }
});
```

### Filtering and Sorting

```typescript
const issues = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'getIssues',
  owner: 'octocat',
  repo: 'Hello-World',
  state: 'all',
  labels: ['bug', 'critical'],
  sort: 'comments',    // 'created', 'updated', 'comments'
  direction: 'desc',   // 'asc', 'desc'
  since: '2024-01-01T00:00:00Z'
});
```

## Authentication

### Personal Access Token

The recommended way to authenticate is using a Personal Access Token:

```typescript
{
  personalAccessToken: 'ghp_xxxxxxxxxxxx'
}
```

### Required Scopes

Depending on your use case, you may need different scopes for your token:

- `repo` - Full control of private repositories
- `public_repo` - Access to public repositories
- `read:org` - Read organization membership
- `user` - Read user profile data

## Rate Limiting

GitHub API has rate limits:
- **Authenticated requests**: 5,000 requests per hour
- **Unauthenticated requests**: 60 requests per hour

The datasource includes retry logic to handle rate limiting automatically.

## Error Handling

```typescript
try {
  const repo = await dataBinder.fetchFromDatasource('github-instance', {
    methodName: 'getRepository',
    owner: 'nonexistent',
    repo: 'repo'
  });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.log('Repository not found');
  } else if (error instanceof AuthenticationError) {
    console.log('Invalid token or insufficient permissions');
  }
}
```

## Best Practices

1. **Use Personal Access Tokens** instead of password authentication
2. **Set appropriate scopes** for your token (principle of least privilege)
3. **Handle rate limits** gracefully
4. **Use pagination** for large result sets
5. **Cache responses** when appropriate to reduce API calls
6. **Monitor your rate limit** usage

## Examples

### Get All Issues from Multiple Repositories

```typescript
const repos = ['repo1', 'repo2', 'repo3'];
const allIssues = [];

for (const repo of repos) {
  const issues = await dataBinder.fetchFromDatasource('github-instance', {
    methodName: 'getIssues',
    owner: 'my-org',
    repo,
    state: 'all'
  });
  allIssues.push(...issues.data);
}
```

### Search for Security Issues

```typescript
const securityIssues = await dataBinder.fetchFromDatasource('github-instance', {
  methodName: 'searchIssues',
  query: 'is:open label:security org:my-org'
});
```

### Get Repository Contents Recursively

```typescript
async function getDirectoryContents(owner, repo, path = '') {
  const contents = await dataBinder.fetchFromDatasource('github-instance', {
    methodName: 'getContents',
    owner,
    repo,
    path
  });

  const files = [];
  for (const item of contents.data) {
    if (item.type === 'file') {
      files.push(item);
    } else if (item.type === 'dir') {
      const subFiles = await getDirectoryContents(owner, repo, item.path);
      files.push(...subFiles);
    }
  }
  return files;
}
```

## API Documentation

For more details on the GitHub API, visit:
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Rate Limiting](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#rate-limiting)
- [Authentication](https://docs.github.com/en/rest/overview/resources-in-the-rest-api#authentication)
