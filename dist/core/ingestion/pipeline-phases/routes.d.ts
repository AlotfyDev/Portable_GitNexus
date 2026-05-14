/**
 * Phase: routes
 *
 * Builds the route registry (Next.js, Expo, PHP, Laravel, decorator-based)
 * and creates Route graph nodes + HANDLES_ROUTE edges.
 * Also links middleware, processes fetch() calls, and scans HTML templates.
 *
 * @deps    parse
 * @reads   allPaths, allExtractedRoutes, allDecoratorRoutes, allFetchCalls
 * @writes  graph (Route nodes, HANDLES_ROUTE, FETCHES_FROM edges)
 * @output  routeRegistry, handlerContents
 */
import type { PipelinePhase } from './types.js';
export interface RouteEntry {
    filePath: string;
    source: string;
}
export interface RoutesOutput {
    routeRegistry: Map<string, RouteEntry>;
}
export declare const routesPhase: PipelinePhase<RoutesOutput>;
