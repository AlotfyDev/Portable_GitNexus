import fs from 'fs/promises';
import path from 'path';
import { execSync, execFileSync } from 'child_process';
import { estimateTokens } from '../../llm-client.js';
import { generateHTMLViewer } from '../../html-viewer.js';
export async function fileExists(fp) {
    try {
        await fs.access(fp);
        return true;
    }
    catch {
        return false;
    }
}
export function truncateSource(source, maxTokens) {
    const maxChars = maxTokens * 4;
    if (source.length <= maxChars)
        return source;
    return source.slice(0, maxChars) + '\n\n... (source truncated for context window limits)';
}
export function getCurrentCommit(repoPath) {
    try {
        return execSync('git rev-parse HEAD', { cwd: repoPath }).toString().trim();
    }
    catch {
        return '';
    }
}
function isCommitReachable(repoPath, fromCommit, toCommit) {
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', fromCommit, toCommit], {
            cwd: repoPath,
            stdio: 'ignore',
        });
        return true;
    }
    catch {
        return false;
    }
}
export function getChangedFiles(repoPath, fromCommit, toCommit) {
    if (!isCommitReachable(repoPath, fromCommit, toCommit)) {
        return null;
    }
    try {
        const output = execFileSync('git', ['diff', `${fromCommit}..${toCommit}`, '--name-only'], {
            cwd: repoPath,
        })
            .toString()
            .trim();
        return output ? output.split('\n').filter(Boolean) : [];
    }
    catch {
        return null;
    }
}
export async function readSourceFiles(repoPath, filePaths) {
    const parts = [];
    for (const fp of filePaths) {
        const fullPath = path.join(repoPath, fp);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            parts.push(`\n--- ${fp} ---\n${content}`);
        }
        catch {
            parts.push(`\n--- ${fp} ---\n(file not readable)`);
        }
    }
    return parts.join('\n');
}
export async function estimateModuleTokens(repoPath, filePaths) {
    let total = 0;
    for (const fp of filePaths) {
        try {
            const content = await fs.readFile(path.join(repoPath, fp), 'utf-8');
            total += estimateTokens(content);
        }
        catch {
        }
    }
    return total;
}
export async function readProjectInfo(repoPath) {
    const candidates = [
        'package.json',
        'Cargo.toml',
        'pyproject.toml',
        'go.mod',
        'pom.xml',
        'build.gradle',
    ];
    const lines = [`Project: ${path.basename(repoPath)}`];
    for (const file of candidates) {
        const fullPath = path.join(repoPath, file);
        try {
            const content = await fs.readFile(fullPath, 'utf-8');
            if (file === 'package.json') {
                const pkg = JSON.parse(content);
                if (pkg.name)
                    lines.push(`Name: ${pkg.name}`);
                if (pkg.description)
                    lines.push(`Description: ${pkg.description}`);
                if (pkg.scripts)
                    lines.push(`Scripts: ${Object.keys(pkg.scripts).join(', ')}`);
            }
            else {
                lines.push(`\n${file}:\n${content.slice(0, 500)}`);
            }
            break;
        }
        catch {
            continue;
        }
    }
    for (const readme of ['README.md', 'readme.md', 'README.txt']) {
        try {
            const content = await fs.readFile(path.join(repoPath, readme), 'utf-8');
            lines.push(`\nREADME excerpt:\n${content.slice(0, 1000)}`);
            break;
        }
        catch {
            continue;
        }
    }
    return lines.join('\n');
}
export async function loadWikiMeta(wikiDir) {
    try {
        const raw = await fs.readFile(path.join(wikiDir, 'meta.json'), 'utf-8');
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
export async function saveWikiMeta(wikiDir, meta) {
    await fs.writeFile(path.join(wikiDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf-8');
}
export async function saveModuleTree(wikiDir, tree) {
    await fs.writeFile(path.join(wikiDir, 'module_tree.json'), JSON.stringify(tree, null, 2), 'utf-8');
}
export async function ensureHTMLViewer(wikiDir, repoPath, onProgress) {
    const dirEntries = await fs.readdir(wikiDir).catch(() => []);
    const hasMd = dirEntries.some((f) => f.endsWith('.md'));
    if (!hasMd)
        return;
    onProgress('html', 98, 'Building HTML viewer...');
    const repoName = path.basename(repoPath);
    await generateHTMLViewer(wikiDir, repoName);
}
export async function runParallel(items, fn, concurrency, onProgress, lastPercentRef) {
    let total = 0;
    let activeConcurrency = concurrency;
    let running = 0;
    let idx = 0;
    return new Promise((resolve, reject) => {
        const next = () => {
            while (running < activeConcurrency && idx < items.length) {
                const item = items[idx++];
                running++;
                fn(item)
                    .then((count) => {
                    total += count;
                    running--;
                    if (idx >= items.length && running === 0) {
                        resolve(total);
                    }
                    else {
                        next();
                    }
                })
                    .catch((err) => {
                    running--;
                    if (err.message?.includes('429')) {
                        activeConcurrency = Math.max(1, activeConcurrency - 1);
                        onProgress('modules', lastPercentRef.value, `Rate limited — concurrency → ${activeConcurrency}`);
                        idx--;
                        setTimeout(next, 5000);
                    }
                    else {
                        if (idx >= items.length && running === 0) {
                            resolve(total);
                        }
                        else {
                            next();
                        }
                    }
                });
            }
        };
        if (items.length === 0) {
            resolve(0);
        }
        else {
            next();
        }
    });
}
