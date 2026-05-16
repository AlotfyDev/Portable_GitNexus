import path from 'node:path';
import { generateId } from '../utils/generate-id.js';
import type { KnowledgeGraph } from '../../graph/types.js';
import { preprocessCobolSource, extractCobolSymbolsWithRegex } from '../cobol/cobol-preprocessor.js';
import { expandCopies } from '../cobol/cobol-copy-expander.js';
import { processJclFiles } from '../cobol/jcl-processor.js';
import { CobolFile, CobolProcessResult } from './types.js';
import { COBOL_EXTENSIONS, JCL_EXTENSIONS } from './constants.js';
import { isCopybook } from './detectors.js';
import { mapToGraph } from './graph-mapper.js';

/**
 * Process COBOL and JCL files into the knowledge graph.
 *
 * @param graph    - The in-memory knowledge graph
 * @param files    - Array of { path, content } for COBOL/JCL files
 * @param allPathSet - Set of all file paths in the repository
 * @returns Summary of what was extracted
 */
const processCobol = (
  graph: KnowledgeGraph,
  files: CobolFile[],
  allPathSet: ReadonlySet<string>,
): CobolProcessResult => {
  const result: CobolProcessResult = {
    programs: 0,
    paragraphs: 0,
    sections: 0,
    dataItems: 0,
    calls: 0,
    copies: 0,
    execSqlBlocks: 0,
    execCicsBlocks: 0,
    entryPoints: 0,
    moves: 0,
    fileDeclarations: 0,
    jclJobs: 0,
    jclSteps: 0,
    sqlIncludes: 0,
    execDliBlocks: 0,
    declaratives: 0,
    sets: 0,
    inspects: 0,
    initializes: 0,
  };

  // ── 1. Separate programs, copybooks, and JCL ───────────────────────
  const programs: CobolFile[] = [];
  const copybooks: CobolFile[] = [];
  const jclFiles: CobolFile[] = [];

  for (const file of files) {
    const ext = path.extname(file.path).toLowerCase();
    if (JCL_EXTENSIONS.has(ext)) {
      jclFiles.push(file);
    } else if (isCopybook(file.path)) {
      copybooks.push(file);
    } else if (COBOL_EXTENSIONS.has(ext)) {
      programs.push(file);
    }
  }

  // ── 2. Build copybook map (uppercase name -> content) ──────────────
  const copybookMap = new Map<string, { content: string; path: string }>();
  for (const cb of copybooks) {
    const name = path.basename(cb.path, path.extname(cb.path)).toUpperCase();
    copybookMap.set(name, { content: cb.content, path: cb.path });
  }

  const copybookByPath = new Map<string, string>();
  for (const [, entry] of copybookMap) {
    copybookByPath.set(entry.path, entry.content);
  }

  const resolveCopy = (name: string): string | null => {
    const entry = copybookMap.get(name.toUpperCase());
    return entry ? entry.path : null;
  };
  const readCopy = (copyPath: string): string | null => {
    const content = copybookByPath.get(copyPath);
    return content ? preprocessCobolSource(content) : null;
  };

  const moduleNodeIds = new Map<string, string>();

  // ── 3. Process each COBOL program ──────────────────────────────────
  for (const file of programs) {
    const fileNodeId = generateId('File', file.path);
    if (!graph.getNode(fileNodeId)) continue;

    const cleaned = preprocessCobolSource(file.content);

    const { expandedContent, copyResolutions } = expandCopies(
      cleaned,
      file.path,
      resolveCopy,
      readCopy,
    );

    const extracted = extractCobolSymbolsWithRegex(expandedContent, file.path);

    mapToGraph(graph, extracted, file, copyResolutions, moduleNodeIds);

    result.programs += extracted.programs.length || (extracted.programName ? 1 : 0);
    result.paragraphs += extracted.paragraphs.length;
    result.sections += extracted.sections.length;
    result.dataItems += extracted.dataItems.length;
    result.calls += extracted.calls.length;
    result.copies += extracted.copies.length;
    result.execSqlBlocks += extracted.execSqlBlocks.length;
    result.sqlIncludes += extracted.execSqlBlocks.filter((s) => s.includeMember).length;
    result.execCicsBlocks += extracted.execCicsBlocks.length;
    result.entryPoints += extracted.entryPoints.length;
    result.moves += extracted.moves.length;
    result.fileDeclarations += extracted.fileDeclarations.length;
    result.execDliBlocks += extracted.execDliBlocks.length;
    result.declaratives += extracted.declaratives.length;
    result.sets += extracted.sets.length;
    result.inspects += extracted.inspects.length;
    result.initializes += extracted.initializes.length;
  }

  // ── 4. Second pass: resolve cross-program CALL targets ─────────────
  const unresolvedToRemove: string[] = [];

  graph.forEachRelationship((rel) => {
    if (rel.type !== 'CALLS') return;
    const match = rel.targetId.match(/<unresolved>:(.+)/);
    if (!match) return;
    const resolvedId = moduleNodeIds.get(match[1]);
    if (!resolvedId) return;

    if (
      rel.reason?.startsWith('cobol-call-unresolved') ||
      rel.reason === 'cobol-cancel-unresolved'
    ) {
      const resolvedReason =
        rel.reason === 'cobol-cancel-unresolved' ? 'cobol-cancel' : 'cobol-call';
      graph.addRelationship({
        id: rel.id + ':resolved',
        type: 'CALLS',
        sourceId: rel.sourceId,
        targetId: resolvedId,
        confidence: rel.reason === 'cobol-cancel-unresolved' ? 0.9 : 0.95,
        reason: resolvedReason,
      });
    } else if (rel.reason?.startsWith('cics-') && rel.reason.endsWith('-unresolved')) {
      graph.addRelationship({
        id: rel.id + ':resolved',
        type: 'CALLS',
        sourceId: rel.sourceId,
        targetId: resolvedId,
        confidence: 0.95,
        reason: rel.reason.replace('-unresolved', ''),
      });
    }

    unresolvedToRemove.push(rel.id);
  });

  for (const id of unresolvedToRemove) {
    graph.removeRelationship(id);
  }

  // ── 5. Process JCL files ───────────────────────────────────────────
  if (jclFiles.length > 0) {
    const jclPaths = jclFiles.map((f) => f.path);
    const jclContents = new Map<string, string>();
    for (const f of jclFiles) {
      jclContents.set(f.path, f.content);
    }
    const jclResult = processJclFiles(graph, jclPaths, jclContents);
    result.jclJobs += jclResult.jobCount;
    result.jclSteps += jclResult.stepCount;
  }

  return result;
};

export { processCobol };
