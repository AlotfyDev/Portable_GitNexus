export const ROUTE_HTTP_METHODS = new Set([
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'options',
    'any',
    'match',
]);
export const ROUTE_RESOURCE_METHODS = new Set(['resource', 'apiResource']);
export const EXPRESS_ROUTE_METHODS = new Set([
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'all',
    'use',
    'route',
]);
export const HTTP_CLIENT_ONLY_METHODS = new Set(['head', 'options', 'request', 'ajax']);
export const HTTP_CLIENT_RECEIVERS = new Set([
    'axios',
    'request',
    'fetch',
    'http',
    'https',
    'got',
    'ky',
    'superagent',
    'needle',
    'undici',
    'apiclient',
    'client',
    'httpclient',
    'api',
    '$http',
    'session',
    'httpservice',
    'conn',
]);
export const ROUTE_DECORATOR_NAMES = new Set([
    'Get',
    'Post',
    'Put',
    'Delete',
    'Patch',
    'Route',
    'get',
    'post',
    'put',
    'delete',
    'patch',
    'route',
    'RequestMapping',
    'GetMapping',
    'PostMapping',
    'PutMapping',
    'DeleteMapping',
]);
export const RESOURCE_ACTIONS = ['index', 'create', 'store', 'show', 'edit', 'update', 'destroy'];
export const API_RESOURCE_ACTIONS = ['index', 'store', 'show', 'update', 'destroy'];
export const PRISMA_QUERY_RE = /\bprisma\.(\w+)\.(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|create|createMany|update|updateMany|delete|deleteMany|upsert|count|aggregate|groupBy)\s*\(/g;
export const SUPABASE_QUERY_RE = /\bsupabase\.from\s*\(\s*['"](\w+)['"]\s*\)\s*\.(select|insert|update|delete|upsert)\s*\(/g;
