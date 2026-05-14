// ── Extracted modules (preserved backward-compatible exports) ──────────────

export { ExportedTypeMap, OverloadHints } from './call-processor/types.js';

export {
  buildImportedReturnTypes,
  buildImportedRawReturnTypes,
  buildExportedTypeMapFromGraph,
} from './call-processor/helpers/exported-types.js';

export { seedCrossFileReceiverTypes } from './call-processor/helpers/seed-cross-file-receivers.js';

export {
  processCalls,
} from './call-processor/process-calls.js';

export {
  _resolveCallTargetForTesting,
} from './call-processor/helpers/resolve-call-target.js';

export {
  resolveMemberCall,
} from './call-processor/helpers/resolve-member-call.js';

export {
  resolveFreeCall,
} from './call-processor/helpers/resolve-free-call.js';

export {
  resolveStaticCall,
} from './call-processor/helpers/resolve-static-call.js';

export {
  processCallsFromExtracted,
} from './call-processor/process-calls-from-extracted.js';

export {
  processAssignmentsFromExtracted,
} from './call-processor/helpers/assignments.js';

export {
  processRoutesFromExtracted,
  extractConsumerAccessedKeys,
  processNextjsFetchRoutes,
} from './call-processor/helpers/routes.js';

export {
  extractFetchCallsFromFiles,
} from './call-processor/helpers/fetch-calls.js';
