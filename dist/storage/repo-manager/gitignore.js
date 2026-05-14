import fs from 'fs/promises';
import path from 'path';
import { GITNEXUS_DIR, GITNEXUS_EXCLUDE_ENTRY } from './constants.js';
import { getStoragePath } from './paths.js';
export const ensureGitNexusIgnored = async (repoPath) => {
    const gitignorePath = path.join(getStoragePath(repoPath), '.gitignore');
    await fs.mkdir(path.dirname(gitignorePath), { recursive: true });
    await fs.writeFile(gitignorePath, '*\n', 'utf-8');
    await ensureGitInfoExclude(repoPath);
};
const ensureGitInfoExclude = async (repoPath) => {
    const gitDirPath = path.join(path.resolve(repoPath), '.git');
    const excludePath = path.join(gitDirPath, 'info', 'exclude');
    try {
        const gitDir = await fs.stat(gitDirPath);
        if (!gitDir.isDirectory())
            return;
    }
    catch {
        return;
    }
    await fs.mkdir(path.dirname(excludePath), { recursive: true });
    let content = '';
    try {
        content = await fs.readFile(excludePath, 'utf-8');
    }
    catch (err) {
        if (err?.code !== 'ENOENT')
            throw err;
    }
    const excludes = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    if (excludes.includes(GITNEXUS_DIR) || excludes.includes(GITNEXUS_EXCLUDE_ENTRY))
        return;
    const separator = content.length === 0 || content.endsWith('\n') ? '' : '\n';
    await fs.writeFile(excludePath, `${content}${separator}${GITNEXUS_EXCLUDE_ENTRY}\n`, 'utf-8');
};
