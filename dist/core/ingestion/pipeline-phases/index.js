/**
 * Pipeline Phases — barrel export.
 *
 * Exports all phases, the runner, types, and shared utilities
 * for the ingestion pipeline.
 */
// ── Phase exports (in dependency order) ────────────────────────────────────
export { scanPhase } from './scan.js';
export { structurePhase } from './structure.js';
export { markdownPhase } from './markdown.js';
export { cobolPhase } from './cobol.js';
export { parsePhase } from './parse.js';
export { routesPhase } from './routes.js';
export { toolsPhase } from './tools.js';
export { ormPhase } from './orm.js';
export { crossFilePhase } from './cross-file.js';
export { scopeResolutionPhase, } from '../scope-resolution/pipeline/phase.js';
export { mroPhase } from './mro.js';
export { communitiesPhase } from './communities.js';
export { processesPhase } from './processes.js';
// ── Infrastructure ─────────────────────────────────────────────────────────
export { runPipeline } from './runner.js';
export { getPhaseOutput } from './types.js';
