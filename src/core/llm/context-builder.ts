/**
 * Context Builder for Graph RAG Agent
 *
 * Generates dynamic context about the loaded codebase to inject into the system prompt.
 */

export interface CodebaseStats {
  projectName: string;
  fileCount: number;
  functionCount: number;
  classCount: number;
  interfaceCount: number;
  methodCount: number;
}

export interface Hotspot {
  name: string;
  type: string;
  filePath: string;
  connections: number;
}

interface FolderInfo {
  path: string;
  name: string;
  depth: number;
  fileCount: number;
  children: FolderInfo[];
}

export interface CodebaseContext {
  stats: CodebaseStats;
  hotspots: Hotspot[];
  folderTree: string;
}

export async function getCodebaseStats(
  executeQuery: (cypher: string) => Promise<any[]>,
  projectName: string,
): Promise<CodebaseStats> {
  try {
    const countQueries = [
      { type: 'files', query: 'MATCH (n:File) RETURN COUNT(n) AS count' },
      { type: 'functions', query: 'MATCH (n:Function) RETURN COUNT(n) AS count' },
      { type: 'classes', query: 'MATCH (n:Class) RETURN COUNT(n) AS count' },
      { type: 'interfaces', query: 'MATCH (n:Interface) RETURN COUNT(n) AS count' },
      { type: 'methods', query: 'MATCH (n:Method) RETURN COUNT(n) AS count' },
    ];

    const counts: Record<string, number> = {};

    for (const { type, query } of countQueries) {
      try {
        const result = await executeQuery(query);
        const row = result[0];
        counts[type] = Array.isArray(row) ? (row[0] ?? 0) : (row?.count ?? 0);
      } catch {
        counts[type] = 0;
      }
    }

    return {
      projectName,
      fileCount: counts.files,
      functionCount: counts.functions,
      classCount: counts.classes,
      interfaceCount: counts.interfaces,
      methodCount: counts.methods,
    };
  } catch (error) {
    console.error('Failed to get codebase stats:', error);
    return { projectName, fileCount: 0, functionCount: 0, classCount: 0, interfaceCount: 0, methodCount: 0 };
  }
}

export async function getHotspots(
  executeQuery: (cypher: string) => Promise<any[]>,
  limit: number = 8,
): Promise<Hotspot[]> {
  try {
    const query = `
      MATCH (n)-[r:CodeRelation]-(m)
      WHERE n.name IS NOT NULL
      WITH n, COUNT(r) AS connections
      ORDER BY connections DESC
      LIMIT ${limit}
      RETURN n.name AS name, LABEL(n) AS type, n.filePath AS filePath, connections
    `;

    const results = await executeQuery(query);

    return results
      .map((row) => {
        if (Array.isArray(row)) {
          return { name: row[0], type: row[1], filePath: row[2], connections: row[3] };
        }
        return { name: row.name, type: row.type, filePath: row.filePath, connections: row.connections };
      })
      .filter((h) => h.name && h.type);
  } catch (error) {
    console.error('Failed to get hotspots:', error);
    return [];
  }
}

export async function getFolderTree(
  executeQuery: (cypher: string) => Promise<any[]>,
  maxDepth: number = 10,
): Promise<string> {
  try {
    const query = 'MATCH (f:File) RETURN f.filePath AS path ORDER BY path';
    const results = await executeQuery(query);

    const paths = results
      .map((row) => {
        if (Array.isArray(row)) return row[0];
        return row.path;
      })
      .filter(Boolean);

    if (paths.length === 0) return '';
    return formatAsHybridAscii(paths, maxDepth);
  } catch (error) {
    console.error('Failed to get folder tree:', error);
    return '';
  }
}

function formatAsHybridAscii(paths: string[], maxDepth: number): string {
  interface TreeNode {
    isFile: boolean;
    children: Map<string, TreeNode>;
    fileCount: number;
  }

  const root: TreeNode = { isFile: false, children: new Map(), fileCount: 0 };

  for (const path of paths) {
    const normalized = path.replace(/\\/g, '/');
    const parts = normalized.split('/').filter(Boolean);

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, { isFile, children: new Map(), fileCount: 0 });
      }

      current = current.children.get(part)!;
      if (isFile) {
        let parent = root;
        for (let j = 0; j < i; j++) {
          parent = parent.children.get(parts[j])!;
          parent.fileCount++;
        }
      }
    }
  }

  const lines: string[] = [];

  function renderNode(node: TreeNode, indent: string, depth: number): void {
    const entries = [...node.children.entries()];
    entries.sort(([aName, aNode], [bName, bNode]) => {
      if (aNode.isFile !== bNode.isFile) return aNode.isFile ? 1 : -1;
      if (!aNode.isFile && !bNode.isFile) return bNode.fileCount - aNode.fileCount;
      return aName.localeCompare(bName);
    });

    for (const [name, childNode] of entries) {
      if (childNode.isFile) {
        lines.push(`${indent}${name}`);
      } else {
        const childCount = childNode.children.size;
        const fileCount = childNode.fileCount;

        if (depth >= maxDepth) {
          lines.push(`${indent}${name}/ (${fileCount} files)`);
        } else {
          lines.push(`${indent}${name}/`);
          renderNode(childNode, indent + '  ', depth + 1);
        }
      }
    }
  }

  renderNode(root, '', 0);
  return lines.join('\n');
}

export async function buildCodebaseContext(
  executeQuery: (cypher: string) => Promise<any[]>,
  projectName: string,
): Promise<CodebaseContext> {
  const [stats, hotspots, folderTree] = await Promise.all([
    getCodebaseStats(executeQuery, projectName),
    getHotspots(executeQuery),
    getFolderTree(executeQuery),
  ]);

  return { stats, hotspots, folderTree };
}

export function formatContextForPrompt(context: CodebaseContext): string {
  const { stats, hotspots, folderTree } = context;

  const lines: string[] = [];

  lines.push(`CODEBASE: ${stats.projectName}`);

  const statParts = [
    `Files: ${stats.fileCount}`,
    `Functions: ${stats.functionCount}`,
    stats.classCount > 0 ? `Classes: ${stats.classCount}` : null,
    stats.interfaceCount > 0 ? `Interfaces: ${stats.interfaceCount}` : null,
  ].filter(Boolean);
  lines.push(statParts.join(' | '));
  lines.push('');

  if (hotspots.length > 0) {
    lines.push('Hotspots (most connected):');
    hotspots.slice(0, 5).forEach((h) => {
      lines.push(`- \`${h.name}\` (${h.type}) — ${h.connections} edges`);
    });
    lines.push('');
  }

  if (folderTree) {
    lines.push('STRUCTURE:');
    lines.push('```');
    lines.push(stats.projectName + '/');
    lines.push(folderTree);
    lines.push('```');
  }

  return lines.join('\n');
}

export function buildDynamicSystemPrompt(basePrompt: string, context: CodebaseContext): string {
  const contextSection = formatContextForPrompt(context);
  return `${basePrompt}

---

## CURRENT CODEBASE
${contextSection}`;
}
