import path from 'path';
export function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
}
export function parseGroupingResponse(content, files) {
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
    }
    let parsed;
    try {
        parsed = JSON.parse(jsonStr);
    }
    catch {
        return fallbackGrouping(files);
    }
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        return fallbackGrouping(files);
    }
    const allFilePaths = new Set(files.map((f) => f.filePath));
    const assignedFiles = new Set();
    const validGrouping = {};
    for (const [mod, paths] of Object.entries(parsed)) {
        if (!Array.isArray(paths))
            continue;
        const validPaths = paths.filter((p) => {
            if (allFilePaths.has(p) && !assignedFiles.has(p)) {
                assignedFiles.add(p);
                return true;
            }
            return false;
        });
        if (validPaths.length > 0) {
            validGrouping[mod] = validPaths;
        }
    }
    const unassigned = files.map((f) => f.filePath).filter((fp) => !assignedFiles.has(fp));
    if (unassigned.length > 0) {
        validGrouping['Other'] = unassigned;
    }
    return Object.keys(validGrouping).length > 0 ? validGrouping : fallbackGrouping(files);
}
export function fallbackGrouping(files) {
    const groups = new Map();
    for (const f of files) {
        const parts = f.filePath.replace(/\\/g, '/').split('/');
        const topDir = parts.length > 1 ? parts[0] : 'Root';
        let group = groups.get(topDir);
        if (!group) {
            group = [];
            groups.set(topDir, group);
        }
        group.push(f.filePath);
    }
    return Object.fromEntries(groups);
}
export function splitBySubdirectory(moduleName, files) {
    const subGroups = new Map();
    for (const fp of files) {
        const parts = fp.replace(/\\/g, '/').split('/');
        const subDir = parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
        let group = subGroups.get(subDir);
        if (!group) {
            group = [];
            subGroups.set(subDir, group);
        }
        group.push(fp);
    }
    const basenames = Array.from(subGroups.keys()).map((s) => path.basename(s));
    const hasCollisions = new Set(basenames).size < basenames.length;
    return Array.from(subGroups.entries()).map(([subDir, subFiles]) => {
        const label = hasCollisions ? subDir.replace(/\//g, '-') : path.basename(subDir);
        return {
            name: `${moduleName} — ${label}`,
            slug: slugify(`${moduleName}-${label}`),
            files: subFiles,
        };
    });
}
export function extractModuleFiles(tree) {
    const result = {};
    for (const node of tree) {
        if (node.children && node.children.length > 0) {
            result[node.name] = node.children.flatMap((c) => c.files);
            for (const child of node.children) {
                result[child.name] = child.files;
            }
        }
        else {
            result[node.name] = node.files;
        }
    }
    return result;
}
export function countModules(tree) {
    let count = 0;
    for (const node of tree) {
        count++;
        if (node.children) {
            count += node.children.length;
        }
    }
    return count;
}
export function flattenModuleTree(tree) {
    const leaves = [];
    const parents = [];
    for (const node of tree) {
        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                leaves.push(child);
            }
            parents.push(node);
        }
        else {
            leaves.push(node);
        }
    }
    return { leaves, parents };
}
export function findNodeBySlug(tree, slug) {
    for (const node of tree) {
        if (node.slug === slug)
            return node;
        if (node.children) {
            const found = findNodeBySlug(node.children, slug);
            if (found)
                return found;
        }
    }
    return null;
}
