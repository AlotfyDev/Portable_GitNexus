import { Router } from 'express';
import type { ServerDependencies } from '../types.js';
import { createRepoResolver, requestedRepo } from '../middleware/repo-resolver.js';
import { createRouteLimiter, assertString, escapeRegExp } from '../validation.js';
import { statusFromError } from '../middleware/error-handler.js';
import path from 'path';
import fs from 'fs/promises';
import { createDatabaseProvider } from '../../core/config/database-config.js';
const db = createDatabaseProvider();

export const handleFileRequest = async (
  req: { query: any },
  res: {
    status: (code: number) => { json: (body: any) => void };
    json: (body: any) => void;
  },
  repoPath: string,
): Promise<void> => {
  try {
    const rawFilePath = req.query.path;
    if (rawFilePath === undefined || rawFilePath === '') {
      res.status(400).json({ error: 'Missing path' });
      return;
    }
    const filePath = assertString(rawFilePath, 'path');

    const repoRoot = path.resolve(repoPath);
    const fullPath = path.resolve(repoRoot, filePath);
    const fullRel = path.relative(repoRoot, fullPath);
    if (fullRel.startsWith('..') || path.isAbsolute(fullRel)) {
      res.status(403).json({ error: 'Path traversal denied' });
      return;
    }

    const raw = await fs.readFile(fullPath, 'utf-8');

    const startLine = req.query.startLine !== undefined ? Number(req.query.startLine) : undefined;
    const endLine = req.query.endLine !== undefined ? Number(req.query.endLine) : undefined;

    if (startLine !== undefined && Number.isFinite(startLine)) {
      const lines = raw.split('\n');
      const start = Math.max(0, startLine);
      const end =
        endLine !== undefined && Number.isFinite(endLine)
          ? Math.min(lines.length, endLine + 1)
          : lines.length;
      res.json({
        content: lines.slice(start, end).join('\n'),
        startLine: start,
        endLine: end - 1,
        totalLines: lines.length,
      });
    } else {
      res.json({ content: raw, totalLines: raw.split('\n').length });
    }
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(statusFromError(err)).json({ error: err.message || 'Failed to read file' });
    }
  }
};

export function mountFile(router: Router, deps: ServerDependencies): void {
  const resolveRepo = createRepoResolver(deps.backend, deps.jobManager, deps.config.repoHoldTimeoutMs);

  router.get('/api/file', createRouteLimiter(), async (req, res) => {
    const entry = await resolveRepo(requestedRepo(req));
    if (!entry) {
      res.status(404).json({ error: 'Repository not found' });
      return;
    }
    await handleFileRequest(req, res, entry.path);
  });

  router.get('/api/grep', createRouteLimiter(), async (req, res) => {
    try {
      const entry = await resolveRepo(requestedRepo(req));
      if (!entry) {
        res.status(404).json({ error: 'Repository not found' });
        return;
      }
      const rawPattern = req.query.pattern;
      if (rawPattern === undefined) {
        res.status(400).json({ error: 'Missing "pattern" query parameter' });
        return;
      }
      const pattern = assertString(rawPattern, 'pattern');
      if (pattern.length === 0) {
        res.status(400).json({ error: 'Missing "pattern" query parameter' });
        return;
      }

      if (pattern.length > 200) {
        res.status(400).json({ error: 'Pattern too long (max 200 characters)' });
        return;
      }

      const effectivePattern = escapeRegExp(pattern);

      let regex: RegExp;
      try {
        regex = new RegExp(effectivePattern, 'gim');
      } catch {
        res.status(400).json({ error: 'Invalid regex pattern' });
        return;
      }

      const parsedLimit = Number(req.query.limit ?? 50);
      const limit = Number.isFinite(parsedLimit)
        ? Math.max(1, Math.min(200, Math.trunc(parsedLimit)))
        : 50;

      const results: { filePath: string; line: number; text: string }[] = [];
      const repoRoot = path.resolve(entry.path);

      const fileRows = await db.executeQuery(entry.name,
        `MATCH (n:File) WHERE n.content IS NOT NULL RETURN n.filePath AS filePath`,
      );

      for (const row of fileRows) {
        if (results.length >= limit) break;
        const filePath: string = row.filePath || '';
        const fullPath = path.resolve(repoRoot, filePath);

        if (!fullPath.startsWith(repoRoot + path.sep) && fullPath !== repoRoot) continue;

        let content: string;
        try {
          content = await fs.readFile(fullPath, 'utf-8');
        } catch {
          continue;
        }

        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (results.length >= limit) break;
          if (regex.test(lines[i])) {
            results.push({ filePath, line: i + 1, text: lines[i].trim().slice(0, 200) });
          }
          regex.lastIndex = 0;
        }
      }

      res.json({ results });
    } catch (err: any) {
      res.status(statusFromError(err)).json({ error: err.message || 'Grep failed' });
    }
  });
}
