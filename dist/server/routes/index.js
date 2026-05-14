import { mountHealth } from './health.js';
import { mountRepos } from './repos.js';
import { mountGraph } from './graph.js';
import { mountQuery } from './query.js';
import { mountSearch } from './search.js';
import { mountFile } from './file.js';
import { mountProcesses } from './processes.js';
import { mountAnalyze } from './analyze.js';
import { mountEmbedding } from './embedding.js';
export function mountAllRoutes(router, deps) {
    mountHealth(router, deps);
    mountRepos(router, deps);
    mountGraph(router, deps);
    mountQuery(router, deps);
    mountSearch(router, deps);
    mountFile(router, deps);
    mountProcesses(router, deps);
    mountAnalyze(router, deps);
    mountEmbedding(router, deps);
}
