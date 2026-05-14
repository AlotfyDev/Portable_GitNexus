/**
 * Phase: processes
 *
 * Detects execution flows (processes) and creates Process nodes +
 * STEP_IN_PROCESS edges. Also links Route/Tool nodes to processes.
 *
 * @deps    communities, routes, tools
 * @reads   graph (all nodes and relationships), communityResult, routeRegistry, toolDefs
 * @writes  graph (Process nodes, STEP_IN_PROCESS edges, ENTRY_POINT_OF edges)
 */
import type { PipelinePhase } from './types.js';
import { type ProcessDetectionResult } from '../process-processor.js';
export interface ProcessesOutput {
    processResult: ProcessDetectionResult;
}
export declare const processesPhase: PipelinePhase<ProcessesOutput>;
