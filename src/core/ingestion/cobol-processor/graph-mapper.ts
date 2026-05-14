import { generateId } from '../../../lib/utils.js';
import { SupportedLanguages } from 'gitnexus-shared';
import type { KnowledgeGraph } from '../../graph/types.js';
import type { CobolRegexResults } from '../cobol/cobol-preprocessor.js';
import { CobolFile } from './types.js';
import { generatePropertyId } from './helpers/property-utils.js';
import { buildDataItemMap } from './helpers/data-item-map.js';
import { findOwningProgramName, findContainingSection } from './helpers/owning-program.js';

function mapToGraph(
  graph: KnowledgeGraph,
  extracted: CobolRegexResults,
  file: CobolFile,
  copyResolutions: Array<{ copyTarget: string; resolvedPath: string | null; line: number }>,
  moduleNodeIds: Map<string, string>,
): void {
  const { path: filePath, content } = file;
  const lines = content.split(/\r?\n/);
  const fileNodeId = generateId('File', filePath);

  // ── PROGRAM-ID -> Module node ────────────────────────────────────
  let moduleId: string | undefined;
  if (extracted.programName) {
    moduleId = generateId('Module', `${filePath}:${extracted.programName}`);
    const metaDesc = [
      extracted.programMetadata.author && `author:${extracted.programMetadata.author}`,
      extracted.programMetadata.dateWritten && `date:${extracted.programMetadata.dateWritten}`,
      extracted.programMetadata.dateCompiled &&
        `compiled:${extracted.programMetadata.dateCompiled}`,
      extracted.programMetadata.installation && `install:${extracted.programMetadata.installation}`,
    ]
      .filter(Boolean)
      .join(' ');
    graph.addNode({
      id: moduleId,
      label: 'Module',
      properties: {
        name: extracted.programName,
        filePath,
        startLine: 1,
        endLine: lines.length,
        language: SupportedLanguages.Cobol,
        isExported: true,
        description: metaDesc || undefined,
      },
    });
    graph.addRelationship({
      id: generateId('CONTAINS', `${fileNodeId}->${moduleId}`),
      type: 'CONTAINS',
      sourceId: fileNodeId,
      targetId: moduleId,
      confidence: 1.0,
      reason: 'cobol-program-id',
    });
    moduleNodeIds.set(extracted.programName.toUpperCase(), moduleId);
  }

  // ── Nested programs -> additional Module nodes ───────────────────
  const programModuleIds = new Map<string, string>();
  if (moduleId) {
    programModuleIds.set(extracted.programName!.toUpperCase(), moduleId);
  }
  for (const prog of extracted.programs) {
    if (prog.name.toUpperCase() === extracted.programName?.toUpperCase()) continue;
    const nestedModuleId = generateId('Module', `${filePath}:${prog.name}`);
    graph.addNode({
      id: nestedModuleId,
      label: 'Module',
      properties: {
        name: prog.name,
        filePath,
        startLine: prog.startLine,
        endLine: prog.endLine,
        language: SupportedLanguages.Cobol,
        isExported: true,
        description: `nested-program${prog.isCommon ? ' common' : ''}`,
      },
    });
    const enclosing = extracted.programs.find(
      (p) =>
        p.startLine < prog.startLine &&
        p.endLine > prog.endLine &&
        p.nestingDepth < prog.nestingDepth,
    );
    const nestedParent = enclosing
      ? (programModuleIds.get(enclosing.name.toUpperCase()) ?? moduleId ?? fileNodeId)
      : (moduleId ?? fileNodeId);
    graph.addRelationship({
      id: generateId('CONTAINS', `${nestedParent}->${nestedModuleId}`),
      type: 'CONTAINS',
      sourceId: nestedParent,
      targetId: nestedModuleId,
      confidence: 1.0,
      reason: 'cobol-nested-program',
    });
    moduleNodeIds.set(prog.name.toUpperCase(), nestedModuleId);
    programModuleIds.set(prog.name.toUpperCase(), nestedModuleId);
  }

  const parentId = moduleId ?? fileNodeId;

  // ── SECTIONs -> Namespace nodes ──────────────────────────────────
  const sectionNodeIds = new Map<string, string>();
  for (let i = 0; i < extracted.sections.length; i++) {
    const sec = extracted.sections[i];
    const nextLine =
      i + 1 < extracted.sections.length ? extracted.sections[i + 1].line - 1 : lines.length;
    const owningPgm = findOwningProgramName(sec.line, extracted.programs);
    const secId = generateId(
      'Namespace',
      `${filePath}:${owningPgm ? owningPgm + ':' : ''}${sec.name}`,
    );
    graph.addNode({
      id: secId,
      label: 'Namespace',
      properties: {
        name: sec.name,
        filePath,
        startLine: sec.line,
        endLine: nextLine,
        language: SupportedLanguages.Cobol,
        isExported: true,
      },
    });
    const secParent = programModuleIds.get(owningPgm ?? '') ?? parentId;
    graph.addRelationship({
      id: generateId('CONTAINS', `${secParent}->${secId}`),
      type: 'CONTAINS',
      sourceId: secParent,
      targetId: secId,
      confidence: 1.0,
      reason: 'cobol-section',
    });
    sectionNodeIds.set(`${owningPgm ?? ''}:${sec.name.toUpperCase()}`, secId);
  }

  // ── PARAGRAPHs -> Function nodes ─────────────────────────────────
  const paraNodeIds = new Map<string, string>();
  for (let i = 0; i < extracted.paragraphs.length; i++) {
    const para = extracted.paragraphs[i];
    const nextLine =
      i + 1 < extracted.paragraphs.length ? extracted.paragraphs[i + 1].line - 1 : lines.length;
    const owningPgmPara = findOwningProgramName(para.line, extracted.programs);
    const paraId = generateId(
      'Function',
      `${filePath}:${owningPgmPara ? owningPgmPara + ':' : ''}${para.name}`,
    );
    graph.addNode({
      id: paraId,
      label: 'Function',
      properties: {
        name: para.name,
        filePath,
        startLine: para.line,
        endLine: nextLine,
        language: SupportedLanguages.Cobol,
        isExported: true,
      },
    });
    const containerId =
      findContainingSection(para.line, extracted.sections, sectionNodeIds, extracted.programs) ??
      programModuleIds.get(owningPgmPara ?? '') ??
      parentId;
    graph.addRelationship({
      id: generateId('CONTAINS', `${containerId}->${paraId}`),
      type: 'CONTAINS',
      sourceId: containerId,
      targetId: paraId,
      confidence: 1.0,
      reason: 'cobol-paragraph',
    });
    paraNodeIds.set(`${owningPgmPara ?? ''}:${para.name.toUpperCase()}`, paraId);
  }

  // ── Data items -> Property nodes ─────────────────────────────────
  for (const item of extracted.dataItems) {
    if (item.name === 'FILLER') continue;
    const propId = generatePropertyId(filePath, item);
    const itemOwner = findOwningProgramName(item.line, extracted.programs);
    const itemParent = programModuleIds.get(itemOwner ?? '') ?? parentId;
    graph.addNode({
      id: propId,
      label: 'Property',
      properties: {
        name: item.name,
        filePath,
        startLine: item.line,
        endLine: item.line,
        language: SupportedLanguages.Cobol,
        description: `level:${item.level} section:${item.section}${item.pic ? ` pic:${item.pic}` : ''}`,
      },
    });
    graph.addRelationship({
      id: generateId('CONTAINS', `${itemParent}->${propId}`),
      type: 'CONTAINS',
      sourceId: itemParent,
      targetId: propId,
      confidence: 1.0,
      reason: 'cobol-data-item',
    });
  }

  // ── Build data item Map early ───────────────────────────────────
  const dataItemMap = buildDataItemMap(extracted.dataItems, filePath);

  // ── OCCURS DEPENDING ON -> ACCESSES edges ──────────────────────
  for (const item of extracted.dataItems) {
    if (item.name === 'FILLER' || !item.dependingOn) continue;
    const propId = generatePropertyId(filePath, item);
    const depFieldId = dataItemMap.get(item.dependingOn.toUpperCase());
    if (depFieldId) {
      graph.addRelationship({
        id: generateId('ACCESSES', `${propId}->depends-on->${item.dependingOn}`),
        type: 'ACCESSES',
        sourceId: propId,
        targetId: depFieldId,
        confidence: 1.0,
        reason: 'cobol-depends-on',
      });
    }
  }

  // Helper: look up paragraph/section by name scoped to the owning program
  const scopedParaLookup = (name: string, lineNum: number): string | undefined => {
    const pgm = findOwningProgramName(lineNum, extracted.programs);
    return (
      paraNodeIds.get(`${pgm ?? ''}:${name.toUpperCase()}`) ??
      sectionNodeIds.get(`${pgm ?? ''}:${name.toUpperCase()}`)
    );
  };
  const scopedCallerLookup = (name: string | null, lineNum: number): string => {
    if (!name) return owningModuleId(lineNum);
    const pgm = findOwningProgramName(lineNum, extracted.programs);
    return (
      paraNodeIds.get(`${pgm ?? ''}:${name.toUpperCase()}`) ??
      programModuleIds.get(pgm ?? '') ??
      parentId
    );
  };
  const owningModuleId = (lineNum: number): string => {
    const pgm = findOwningProgramName(lineNum, extracted.programs);
    return programModuleIds.get(pgm ?? '') ?? parentId;
  };

  // ── PERFORM -> CALLS relationship (intra-file) ──────────────────
  for (const perf of extracted.performs) {
    const targetId = scopedParaLookup(perf.target, perf.line);
    if (!targetId) continue;

    const sourceId = scopedCallerLookup(perf.caller, perf.line);

    graph.addRelationship({
      id: generateId('CALLS', `${sourceId}->perform->${targetId}:L${perf.line}`),
      type: 'CALLS',
      sourceId,
      targetId,
      confidence: 1.0,
      reason: 'cobol-perform',
    });

    if (perf.thruTarget) {
      const thruTargetId = scopedParaLookup(perf.thruTarget, perf.line);
      if (thruTargetId && thruTargetId !== targetId) {
        graph.addRelationship({
          id: generateId('CALLS', `${sourceId}->perform-thru->${thruTargetId}:L${perf.line}`),
          type: 'CALLS',
          sourceId,
          targetId: thruTargetId,
          confidence: 1.0,
          reason: 'cobol-perform-thru',
        });
      }
    }
  }

  // ── CALL -> CALLS relationship (cross-program) ──────────────────
  for (const call of extracted.calls) {
    if (!call.isQuoted) {
      graph.addNode({
        id: generateId('CodeElement', `${filePath}:dynamic-call:${call.target}:L${call.line}`),
        label: 'CodeElement',
        properties: {
          name: `CALL ${call.target}`,
          filePath,
          startLine: call.line,
          endLine: call.line,
          language: SupportedLanguages.Cobol,
          description: 'dynamic-call (target is a data item, not resolvable statically)',
        },
      });
      const dynCallOwner = owningModuleId(call.line);
      graph.addRelationship({
        id: generateId('CONTAINS', `${dynCallOwner}->dynamic-call:${call.target}:L${call.line}`),
        type: 'CONTAINS',
        sourceId: dynCallOwner,
        targetId: generateId(
          'CodeElement',
          `${filePath}:dynamic-call:${call.target}:L${call.line}`,
        ),
        confidence: 1.0,
        reason: 'cobol-dynamic-call',
      });

      if (call.parameters && call.parameters.length > 0) {
        for (const param of call.parameters) {
          const paramPropId = dataItemMap.get(param.toUpperCase());
          if (paramPropId) {
            graph.addRelationship({
              id: generateId('ACCESSES', `${dynCallOwner}->call-using->${param}:L${call.line}`),
              type: 'ACCESSES',
              sourceId: dynCallOwner,
              targetId: paramPropId,
              confidence: 0.9,
              reason: 'cobol-call-using',
            });
          }
        }
      }
      if (call.returning) {
        const retPropId = dataItemMap.get(call.returning.toUpperCase());
        if (retPropId) {
          graph.addRelationship({
            id: generateId(
              'ACCESSES',
              `${dynCallOwner}->call-returning->${call.returning}:L${call.line}`,
            ),
            type: 'ACCESSES',
            sourceId: dynCallOwner,
            targetId: retPropId,
            confidence: 0.9,
            reason: 'cobol-call-returning',
          });
        }
      }
      continue;
    }

    const targetModuleId = moduleNodeIds.get(call.target.toUpperCase());
    const targetId =
      targetModuleId ?? generateId('Module', `<unresolved>:${call.target.toUpperCase()}`);

    const callOwner = owningModuleId(call.line);
    graph.addRelationship({
      id: generateId('CALLS', `${callOwner}->call->${call.target}:L${call.line}`),
      type: 'CALLS',
      sourceId: callOwner,
      targetId,
      confidence: targetModuleId ? 0.95 : 0.5,
      reason: targetModuleId ? 'cobol-call' : 'cobol-call-unresolved',
    });

    if (call.parameters && call.parameters.length > 0) {
      for (const param of call.parameters) {
        const paramPropId = dataItemMap.get(param.toUpperCase());
        if (paramPropId) {
          graph.addRelationship({
            id: generateId('ACCESSES', `${callOwner}->call-using->${param}:L${call.line}`),
            type: 'ACCESSES',
            sourceId: callOwner,
            targetId: paramPropId,
            confidence: 0.9,
            reason: 'cobol-call-using',
          });
        }
      }
    }
    if (call.returning) {
      const retPropId = dataItemMap.get(call.returning.toUpperCase());
      if (retPropId) {
        graph.addRelationship({
          id: generateId(
            'ACCESSES',
            `${callOwner}->call-returning->${call.returning}:L${call.line}`,
          ),
          type: 'ACCESSES',
          sourceId: callOwner,
          targetId: retPropId,
          confidence: 0.9,
          reason: 'cobol-call-returning',
        });
      }
    }
  }

  // ── COPY -> IMPORTS relationship ─────────────────────────────────
  for (const res of copyResolutions) {
    if (!res.resolvedPath) continue;
    const targetFileId = generateId('File', res.resolvedPath);
    graph.addRelationship({
      id: generateId('IMPORTS', `${fileNodeId}->${targetFileId}:${res.copyTarget}`),
      type: 'IMPORTS',
      sourceId: fileNodeId,
      targetId: targetFileId,
      confidence: 1.0,
      reason: 'cobol-copy',
    });
  }

  // ── EXEC SQL blocks -> CodeElement nodes + ACCESSES edges ──────
  for (const sql of extracted.execSqlBlocks) {
    const sqlId = generateId('CodeElement', `${filePath}:exec-sql:L${sql.line}`);
    graph.addNode({
      id: sqlId,
      label: 'CodeElement',
      properties: {
        name: `EXEC SQL ${sql.operation}`,
        filePath,
        startLine: sql.line,
        endLine: sql.line,
        language: SupportedLanguages.Cobol,
        description: `tables:[${sql.tables.join(',')}] cursors:[${sql.cursors.join(',')}]`,
      },
    });
    const sqlOwner = owningModuleId(sql.line);
    graph.addRelationship({
      id: generateId('CONTAINS', `${sqlOwner}->${sqlId}`),
      type: 'CONTAINS',
      sourceId: sqlOwner,
      targetId: sqlId,
      confidence: 1.0,
      reason: 'cobol-exec-sql',
    });
    for (const table of sql.tables) {
      const tableId = generateId('Record', `<db>:${table}`);
      graph.addRelationship({
        id: generateId('ACCESSES', `${sqlId}->${tableId}:${sql.operation}`),
        type: 'ACCESSES',
        sourceId: sqlId,
        targetId: tableId,
        confidence: 0.9,
        reason: `sql-${sql.operation.toLowerCase()}`,
      });
    }

    if (sql.includeMember) {
      const includeTarget = sql.includeMember.toUpperCase();
      graph.addRelationship({
        id: generateId('IMPORTS', `${fileNodeId}->sql-include->${includeTarget}:L${sql.line}`),
        type: 'IMPORTS',
        sourceId: fileNodeId,
        targetId: generateId('File', `<unresolved>:${includeTarget}`),
        confidence: 0.8,
        reason: 'sql-include',
      });
    }
  }

  // ── PROCEDURE DIVISION USING -> ACCESSES edges ──────────────────
  for (const prog of extracted.programs) {
    const progModId = programModuleIds.get(prog.name.toUpperCase()) ?? moduleId;
    if (progModId && prog.procedureUsing && prog.procedureUsing.length > 0) {
      for (const param of prog.procedureUsing) {
        const paramPropId = dataItemMap.get(param.toUpperCase());
        if (paramPropId) {
          graph.addRelationship({
            id: generateId('ACCESSES', `${progModId}->using->${param}`),
            type: 'ACCESSES',
            sourceId: progModId,
            targetId: paramPropId,
            confidence: 1.0,
            reason: 'cobol-procedure-using',
          });
        }
      }
    }
  }

  // ── EXEC CICS blocks -> CodeElement nodes + CALLS edges ────────
  for (const cics of extracted.execCicsBlocks) {
    const cicsId = generateId('CodeElement', `${filePath}:exec-cics:L${cics.line}`);
    graph.addNode({
      id: cicsId,
      label: 'CodeElement',
      properties: {
        name: `EXEC CICS ${cics.command}`,
        filePath,
        startLine: cics.line,
        endLine: cics.line,
        language: SupportedLanguages.Cobol,
        description:
          [
            cics.mapName && `map:${cics.mapName}`,
            cics.programName &&
              `program:${cics.programName}${cics.programIsLiteral === false ? ' (dynamic)' : ''}`,
            cics.transId && `transid:${cics.transId}`,
            cics.fileName && `file:${cics.fileName}`,
            cics.queueName && `queue:${cics.queueName}`,
            cics.labelName && `label:${cics.labelName}`,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      },
    });
    const cicsOwner = owningModuleId(cics.line);
    graph.addRelationship({
      id: generateId('CONTAINS', `${cicsOwner}->${cicsId}`),
      type: 'CONTAINS',
      sourceId: cicsOwner,
      targetId: cicsId,
      confidence: 1.0,
      reason: 'cobol-exec-cics',
    });
    if (cics.programName && ['LINK', 'XCTL', 'LOAD'].includes(cics.command)) {
      if (cics.programIsLiteral === false) {
        graph.addNode({
          id: generateId(
            'CodeElement',
            `${filePath}:cics-dynamic-pgm:${cics.programName}:L${cics.line}`,
          ),
          label: 'CodeElement',
          properties: {
            name: `CICS ${cics.command} ${cics.programName}`,
            filePath,
            startLine: cics.line,
            endLine: cics.line,
            language: SupportedLanguages.Cobol,
            description: `cics-dynamic-program (target is data item ${cics.programName})`,
          },
        });
        graph.addRelationship({
          id: generateId(
            'CONTAINS',
            `${cicsOwner}->cics-dynamic-pgm:${cics.programName}:L${cics.line}`,
          ),
          type: 'CONTAINS',
          sourceId: cicsOwner,
          targetId: generateId(
            'CodeElement',
            `${filePath}:cics-dynamic-pgm:${cics.programName}:L${cics.line}`,
          ),
          confidence: 1.0,
          reason: 'cics-dynamic-program',
        });
      } else {
        const cicsTargetModuleId = moduleNodeIds.get(cics.programName.toUpperCase());
        const targetId =
          cicsTargetModuleId ??
          generateId('Module', `<unresolved>:${cics.programName.toUpperCase()}`);
        const cicsReason = `cics-${cics.command.toLowerCase()}`;
        graph.addRelationship({
          id: generateId(
            'CALLS',
            `${cicsOwner}->cics-${cics.command.toLowerCase()}->${cics.programName}:L${cics.line}`,
          ),
          type: 'CALLS',
          sourceId: cicsOwner,
          targetId,
          confidence: cicsTargetModuleId ? 0.95 : 0.5,
          reason: cicsTargetModuleId ? cicsReason : `${cicsReason}-unresolved`,
        });
      }
    }

    if (cics.fileName) {
      const fileRecordId = generateId('Record', `<cics-file>:${cics.fileName.toUpperCase()}`);
      const ioCommand = cics.command.toUpperCase();
      const isRead = [
        'READ',
        'STARTBR',
        'READNEXT',
        'READPREV',
        'READ NEXT',
        'READ PREV',
        'ENDBR',
      ].includes(ioCommand);
      const isWrite = ['WRITE', 'REWRITE', 'DELETE'].includes(ioCommand);
      const reason = isRead ? 'cics-file-read' : isWrite ? 'cics-file-write' : 'cics-file-access';
      graph.addRelationship({
        id: generateId('ACCESSES', `${cicsId}->file->${cics.fileName}:L${cics.line}`),
        type: 'ACCESSES',
        sourceId: cicsId,
        targetId: fileRecordId,
        confidence: 0.9,
        reason,
      });
    }

    if (cics.queueName) {
      const queueId = generateId('Record', `<queue>:${cics.queueName}`);
      const qCmd = cics.command.toUpperCase();
      const qReason = qCmd.startsWith('READQ')
        ? 'cics-queue-read'
        : qCmd.startsWith('WRITEQ')
          ? 'cics-queue-write'
          : qCmd.startsWith('DELETEQ')
            ? 'cics-queue-delete'
            : 'cics-queue';
      graph.addRelationship({
        id: generateId('ACCESSES', `${cicsId}->queue->${cics.queueName}:L${cics.line}`),
        type: 'ACCESSES',
        sourceId: cicsId,
        targetId: queueId,
        confidence: 0.85,
        reason: qReason,
      });
    }

    if (cics.transId) {
      const cmd = cics.command.toUpperCase();
      if (cmd === 'RETURN' || cmd.startsWith('START')) {
        const transNodeId = generateId('CodeElement', `<transid>:${cics.transId}`);
        graph.addRelationship({
          id: generateId(
            'CALLS',
            `${cicsOwner}->${cmd === 'RETURN' ? 'return' : 'start'}-transid->${cics.transId}:L${cics.line}`,
          ),
          type: 'CALLS',
          sourceId: cicsOwner,
          targetId: transNodeId,
          confidence: 0.8,
          reason: cmd === 'RETURN' ? 'cics-return-transid' : 'cics-start-transid',
        });
      }
    }

    if (cics.mapName) {
      const mapId = generateId('Record', `<map>:${cics.mapName}`);
      graph.addRelationship({
        id: generateId('ACCESSES', `${cicsId}->map->${cics.mapName}:L${cics.line}`),
        type: 'ACCESSES',
        sourceId: cicsId,
        targetId: mapId,
        confidence: 0.85,
        reason: 'cics-map',
      });
    }

    if (cics.intoField) {
      const intoPropId = dataItemMap.get(cics.intoField.toUpperCase());
      if (intoPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${cicsId}->into->${cics.intoField}:L${cics.line}`),
          type: 'ACCESSES',
          sourceId: cicsId,
          targetId: intoPropId,
          confidence: 0.9,
          reason: 'cics-receive-into',
        });
      }
    }

    if (cics.fromField) {
      const fromPropId = dataItemMap.get(cics.fromField.toUpperCase());
      if (fromPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${cicsId}->from->${cics.fromField}:L${cics.line}`),
          type: 'ACCESSES',
          sourceId: cicsId,
          targetId: fromPropId,
          confidence: 0.9,
          reason: 'cics-send-from',
        });
      }
    }

    if (cics.labelName) {
      const labelTargetId = scopedParaLookup(cics.labelName, cics.line);
      if (labelTargetId) {
        graph.addRelationship({
          id: generateId('CALLS', `${cicsOwner}->abend-label->${cics.labelName}:L${cics.line}`),
          type: 'CALLS',
          sourceId: cicsOwner,
          targetId: labelTargetId,
          confidence: 0.9,
          reason: 'cics-handle-abend',
        });
      }
    }
  }

  // ── ENTRY points -> Constructor nodes ──────────────────────────
  for (const entry of extracted.entryPoints) {
    const entryId = generateId('Constructor', `${filePath}:${entry.name}`);
    graph.addNode({
      id: entryId,
      label: 'Constructor',
      properties: {
        name: entry.name,
        filePath,
        startLine: entry.line,
        endLine: entry.line,
        language: SupportedLanguages.Cobol,
        isExported: true,
        description:
          entry.parameters.length > 0 ? `using:${entry.parameters.join(',')}` : undefined,
      },
    });
    const entryOwner = owningModuleId(entry.line);
    graph.addRelationship({
      id: generateId('CONTAINS', `${entryOwner}->${entryId}`),
      type: 'CONTAINS',
      sourceId: entryOwner,
      targetId: entryId,
      confidence: 1.0,
      reason: 'cobol-entry-point',
    });
    moduleNodeIds.set(entry.name.toUpperCase(), entryId);
  }

  // ── DECLARATIVES error handlers -> ACCESSES edges ──────────────────
  for (const decl of extracted.declaratives) {
    const pgm = findOwningProgramName(decl.line, extracted.programs);
    const sectionId = sectionNodeIds.get(`${pgm ?? ''}:${decl.sectionName.toUpperCase()}`);
    if (!sectionId) continue;

    const targetId = generateId('Record', `${filePath}:${decl.target}`);
    graph.addRelationship({
      id: generateId('ACCESSES', `${sectionId}->error-handler->${decl.target}:L${decl.line}`),
      type: 'ACCESSES',
      sourceId: sectionId,
      targetId,
      confidence: 0.9,
      reason: 'cobol-error-handler',
    });
  }

  // ── SET statement -> ACCESSES edges ──────────────────
  for (const set of extracted.sets) {
    const callerId = scopedCallerLookup(set.caller, set.line);
    const reason = set.form === 'to-true' ? 'cobol-set-condition' : 'cobol-set-index';
    for (const target of set.targets) {
      const targetPropId = dataItemMap.get(target.toUpperCase());
      if (targetPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${callerId}->set->${target}:L${set.line}`),
          type: 'ACCESSES',
          sourceId: callerId,
          targetId: targetPropId,
          confidence: 0.9,
          reason,
        });
      }
    }
    if (set.value && /^[A-Z][A-Z0-9-]+$/i.test(set.value)) {
      const valuePropId = dataItemMap.get(set.value.toUpperCase());
      if (valuePropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${callerId}->set-read->${set.value}:L${set.line}`),
          type: 'ACCESSES',
          sourceId: callerId,
          targetId: valuePropId,
          confidence: 0.9,
          reason: 'cobol-set-read',
        });
      }
    }
  }

  // ── INSPECT -> ACCESSES edges ──────────────────
  for (const insp of extracted.inspects) {
    const callerId = scopedCallerLookup(insp.caller, insp.line);
    const inspFieldId = dataItemMap.get(insp.inspectedField.toUpperCase());
    if (inspFieldId) {
      graph.addRelationship({
        id: generateId(
          'ACCESSES',
          `${callerId}->inspect-read->${insp.inspectedField}:L${insp.line}`,
        ),
        type: 'ACCESSES',
        sourceId: callerId,
        targetId: inspFieldId,
        confidence: 0.9,
        reason: 'cobol-inspect-read',
      });
      if (insp.form !== 'tallying') {
        graph.addRelationship({
          id: generateId(
            'ACCESSES',
            `${callerId}->inspect-write->${insp.inspectedField}:L${insp.line}`,
          ),
          type: 'ACCESSES',
          sourceId: callerId,
          targetId: inspFieldId,
          confidence: 0.9,
          reason: 'cobol-inspect-write',
        });
      }
    }
    for (const counter of insp.counters) {
      const counterPropId = dataItemMap.get(counter.toUpperCase());
      if (counterPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${callerId}->inspect-tally->${counter}:L${insp.line}`),
          type: 'ACCESSES',
          sourceId: callerId,
          targetId: counterPropId,
          confidence: 0.9,
          reason: 'cobol-inspect-tally',
        });
      }
    }
  }

  // ── INITIALIZE -> ACCESSES write edges ──────────────────
  for (const init of extracted.initializes) {
    const callerId = scopedCallerLookup(init.caller, init.line);
    const targetPropId = dataItemMap.get(init.target.toUpperCase());
    if (targetPropId) {
      graph.addRelationship({
        id: generateId('ACCESSES', `${callerId}->initialize->${init.target}:L${init.line}`),
        type: 'ACCESSES',
        sourceId: callerId,
        targetId: targetPropId,
        confidence: 0.9,
        reason: 'cobol-initialize',
      });
    }
  }

  // ── EXEC DLI (IMS/DB) -> CodeElement + ACCESSES edges ──────────────
  for (const dli of extracted.execDliBlocks) {
    const dliId = generateId('CodeElement', `${filePath}:exec-dli:L${dli.line}`);
    const dliOwner = owningModuleId(dli.line);
    graph.addNode({
      id: dliId,
      label: 'CodeElement',
      properties: {
        name: `EXEC DLI ${dli.verb}`,
        filePath,
        startLine: dli.line,
        endLine: dli.line,
        language: SupportedLanguages.Cobol,
        description:
          [
            dli.segmentName && `segment:${dli.segmentName}`,
            dli.pcbNumber !== undefined && `pcb:${dli.pcbNumber}`,
            dli.psbName && `psb:${dli.psbName}`,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      },
    });
    graph.addRelationship({
      id: generateId('CONTAINS', `${dliOwner}->${dliId}`),
      type: 'CONTAINS',
      sourceId: dliOwner,
      targetId: dliId,
      confidence: 1.0,
      reason: 'cobol-exec-dli',
    });
    if (dli.segmentName) {
      const segId = generateId('Record', `<ims>:${dli.segmentName}`);
      graph.addRelationship({
        id: generateId('ACCESSES', `${dliId}->${dli.segmentName}:${dli.verb}`),
        type: 'ACCESSES',
        sourceId: dliId,
        targetId: segId,
        confidence: 0.9,
        reason: `dli-${dli.verb.toLowerCase()}`,
      });
    }
    if (dli.intoField) {
      const intoPropId = dataItemMap.get(dli.intoField.toUpperCase());
      if (intoPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${dliId}->into->${dli.intoField}:L${dli.line}`),
          type: 'ACCESSES',
          sourceId: dliId,
          targetId: intoPropId,
          confidence: 0.9,
          reason: 'dli-into',
        });
      }
    }
    if (dli.fromField) {
      const fromPropId = dataItemMap.get(dli.fromField.toUpperCase());
      if (fromPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${dliId}->from->${dli.fromField}:L${dli.line}`),
          type: 'ACCESSES',
          sourceId: dliId,
          targetId: fromPropId,
          confidence: 0.9,
          reason: 'dli-from',
        });
      }
    }
  }

  // ── MOVE data flow -> ACCESSES edges (read/write) ──────────────
  for (const move of extracted.moves) {
    const fromPropId = dataItemMap.get(move.from.toUpperCase());
    const callerId = scopedCallerLookup(move.caller, move.line);

    if (fromPropId) {
      graph.addRelationship({
        id: generateId('ACCESSES', `${callerId}->read->${move.from}:L${move.line}`),
        type: 'ACCESSES',
        sourceId: callerId,
        targetId: fromPropId,
        confidence: 0.9,
        reason: move.corresponding ? 'cobol-move-corresponding-read' : 'cobol-move-read',
      });
    }

    for (const target of move.targets) {
      const toPropId = dataItemMap.get(target.toUpperCase());
      if (toPropId) {
        graph.addRelationship({
          id: generateId('ACCESSES', `${callerId}->write->${target}:L${move.line}`),
          type: 'ACCESSES',
          sourceId: callerId,
          targetId: toPropId,
          confidence: 0.9,
          reason: move.corresponding ? 'cobol-move-corresponding-write' : 'cobol-move-write',
        });
      }
    }
  }

  // ── File declarations -> Record nodes ──────────────────────────
  for (const fd of extracted.fileDeclarations) {
    const fdId = generateId('Record', `${filePath}:${fd.selectName}`);
    graph.addNode({
      id: fdId,
      label: 'Record',
      properties: {
        name: fd.selectName,
        filePath,
        startLine: fd.line,
        endLine: fd.line,
        language: SupportedLanguages.Cobol,
        description: `assign:${fd.assignTo}${fd.isOptional ? ' optional' : ''}${fd.organization ? ` org:${fd.organization}` : ''}${fd.access ? ` access:${fd.access}` : ''}`,
      },
    });
    const fdOwner = owningModuleId(fd.line);
    graph.addRelationship({
      id: generateId('CONTAINS', `${fdOwner}->${fdId}`),
      type: 'CONTAINS',
      sourceId: fdOwner,
      targetId: fdId,
      confidence: 1.0,
      reason: 'cobol-file-declaration',
    });
  }

  // ── GO TO -> CALLS edges ──────────────────────────────────────
  for (const gt of extracted.gotos) {
    const callerId = scopedCallerLookup(gt.caller, gt.line);
    const targetId = scopedParaLookup(gt.target, gt.line);
    if (targetId) {
      graph.addRelationship({
        id: generateId('CALLS', `${callerId}->goto->${gt.target}:L${gt.line}`),
        type: 'CALLS',
        sourceId: callerId,
        targetId,
        confidence: 1.0,
        reason: 'cobol-goto',
      });
    }
  }

  // ── SORT/MERGE -> ACCESSES edges ──────────────────────────────
  for (const sort of extracted.sorts) {
    const sortFileId = generateId('Record', `${filePath}:${sort.sortFile}`);
    const sortOwner = owningModuleId(sort.line);
    for (const usingFile of sort.usingFiles) {
      const usingId = generateId('Record', `${filePath}:${usingFile}`);
      graph.addRelationship({
        id: generateId('ACCESSES', `${sortOwner}->sort-using->${usingFile}:L${sort.line}`),
        type: 'ACCESSES',
        sourceId: sortFileId,
        targetId: usingId,
        confidence: 0.85,
        reason: 'sort-using',
      });
    }
    for (const givingFile of sort.givingFiles) {
      const givingId = generateId('Record', `${filePath}:${givingFile}`);
      graph.addRelationship({
        id: generateId('ACCESSES', `${sortOwner}->sort-giving->${givingFile}:L${sort.line}`),
        type: 'ACCESSES',
        sourceId: sortFileId,
        targetId: givingId,
        confidence: 0.85,
        reason: 'sort-giving',
      });
    }
  }

  // ── SEARCH -> ACCESSES edges ──────────────────────────────────
  for (const search of extracted.searches) {
    const targetPropId = dataItemMap.get(search.target.toUpperCase());
    if (targetPropId) {
      const searchOwner = owningModuleId(search.line);
      graph.addRelationship({
        id: generateId('ACCESSES', `${searchOwner}->search->${search.target}:L${search.line}`),
        type: 'ACCESSES',
        sourceId: searchOwner,
        targetId: targetPropId,
        confidence: 0.9,
        reason: 'cobol-search',
      });
    }
  }

  // ── CANCEL -> CALLS edges ──────────────────
  for (const cancel of extracted.cancels) {
    if (!cancel.isQuoted) {
      graph.addNode({
        id: generateId(
          'CodeElement',
          `${filePath}:dynamic-cancel:${cancel.target}:L${cancel.line}`,
        ),
        label: 'CodeElement',
        properties: {
          name: `CANCEL ${cancel.target}`,
          filePath,
          startLine: cancel.line,
          endLine: cancel.line,
          language: SupportedLanguages.Cobol,
          description: 'dynamic-cancel (target is a data item, not resolvable statically)',
        },
      });
      const cancelOwner = owningModuleId(cancel.line);
      graph.addRelationship({
        id: generateId(
          'CONTAINS',
          `${cancelOwner}->dynamic-cancel:${cancel.target}:L${cancel.line}`,
        ),
        type: 'CONTAINS',
        sourceId: cancelOwner,
        targetId: generateId(
          'CodeElement',
          `${filePath}:dynamic-cancel:${cancel.target}:L${cancel.line}`,
        ),
        confidence: 1.0,
        reason: 'cobol-dynamic-cancel',
      });
      continue;
    }
    const targetModuleId = moduleNodeIds.get(cancel.target.toUpperCase());
    const targetId =
      targetModuleId ?? generateId('Module', `<unresolved>:${cancel.target.toUpperCase()}`);
    const cancelCallOwner = owningModuleId(cancel.line);
    graph.addRelationship({
      id: generateId('CALLS', `${cancelCallOwner}->cancel->${cancel.target}:L${cancel.line}`),
      type: 'CALLS',
      sourceId: cancelCallOwner,
      targetId,
      confidence: targetModuleId ? 0.9 : 0.5,
      reason: targetModuleId ? 'cobol-cancel' : 'cobol-cancel-unresolved',
    });
  }
}

export { mapToGraph };
