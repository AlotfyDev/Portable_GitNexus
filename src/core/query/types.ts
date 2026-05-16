import type { GraphNode, GraphRelationship } from 'gitnexus-shared';
import type { ProviderConfig } from '../llm/types.js';

export interface SearchResult {
  nodeId?: string;
  name?: string;
  type?: string;
  filePath: string;
  score: number;
  rank?: number;
  startLine?: number;
  endLine?: number;
  sources?: string[];
  bm25Score?: number;
  semanticScore?: number;
  connections?: {
    outgoing?: Array<{ name: string; type: string; confidence?: number }>;
    incoming?: Array<{ name: string; type: string; confidence?: number }>;
  };
  cluster?: string;
  processes?: Array<{
    id: string;
    label: string;
    step?: number;
    stepCount?: number;
  }>;
}

export interface GraphData {
  nodes: GraphNode[];
  relationships: GraphRelationship[];
}

export interface ProcessData {
  id: string;
  label: string;
  heuristicLabel?: string;
  processType?: string;
  stepCount?: number;
}

export interface SymbolDetail {
  uid: string;
  name: string;
  kind: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  content?: string;
  methodMetadata?: Record<string, unknown>;
  incoming?: Record<string, Array<{ uid: string; name: string; filePath: string; kind: string }>>;
  outgoing?: Record<string, Array<{ uid: string; name: string; filePath: string; kind: string }>>;
  processes?: Array<{ id: string; name: string; step_index: number; step_count: number }>;
}

export interface ImpactResult {
  target: { id: string; name: string; type: string; filePath: string };
  direction: 'upstream' | 'downstream';
  impactedCount: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'UNKNOWN';
  summary: {
    direct: number;
    processes_affected: number;
    modules_affected: number;
  };
  affected_processes?: any[];
  affected_modules?: any[];
  byDepth?: Record<number, any[]>;
}

export interface ChangeResult {
  summary: {
    changed_count: number;
    affected_count: number;
    changed_files: number;
    risk_level: string;
  };
  changed_symbols: Array<{
    id: string;
    name: string;
    type: string;
    filePath: string;
    change_type: string;
  }>;
  affected_processes: Array<{
    id: string;
    name: string;
    process_type: string;
    step_count: number;
    changed_steps: Array<{ symbol: string; step: number }>;
  }>;
}

export interface SymbolContext {
  status: string;
  symbol: SymbolDetail;
  incoming: Record<string, Array<{ uid: string; name: string; filePath: string; kind: string }>>;
  outgoing: Record<string, Array<{ uid: string; name: string; filePath: string; kind: string }>>;
  processes: Array<{ id: string; name: string; step_index: number; step_count: number }>;
}

export interface RAGOptions {
  provider: ProviderConfig;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  context?: {
    projectName?: string;
    stats?: {
      fileCount: number;
      functionCount: number;
      communityCount: number;
      processCount: number;
    };
  };
}

export interface RAGResult {
  answer: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result?: string }>;
}
