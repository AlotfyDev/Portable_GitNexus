import fs from 'fs/promises';
import path from 'path';
import { estimateTokens, } from '../../llm-client.js';
import { MODULE_SYSTEM_PROMPT, MODULE_USER_PROMPT, PARENT_SYSTEM_PROMPT, PARENT_USER_PROMPT, OVERVIEW_SYSTEM_PROMPT, OVERVIEW_USER_PROMPT, fillTemplate, formatCallEdges, formatProcesses, } from '../../prompts.js';
import { getIntraModuleCallEdges, getInterModuleCallEdges, getProcessesForFiles, getAllProcesses, getInterModuleEdgesForOverview, } from '../../graph-queries.js';
import { extractModuleFiles } from './tree-builder.js';
import { readSourceFiles, readProjectInfo } from './file-utils.js';
import { truncateSource } from './file-utils.js';
export async function generateLeafPage(node, deps) {
    const filePaths = node.files;
    const sourceCode = await readSourceFiles(deps.repoPath, filePaths);
    const totalTokens = estimateTokens(sourceCode);
    let finalSourceCode = sourceCode;
    if (totalTokens > deps.maxTokensPerModule) {
        finalSourceCode = truncateSource(sourceCode, deps.maxTokensPerModule);
    }
    const [intraCalls, interCalls, processes] = await Promise.all([
        getIntraModuleCallEdges(filePaths),
        getInterModuleCallEdges(filePaths),
        getProcessesForFiles(filePaths, 5),
    ]);
    const prompt = fillTemplate(MODULE_USER_PROMPT, {
        MODULE_NAME: node.name,
        SOURCE_CODE: finalSourceCode,
        INTRA_CALLS: formatCallEdges(intraCalls),
        OUTGOING_CALLS: formatCallEdges(interCalls.outgoing),
        INCOMING_CALLS: formatCallEdges(interCalls.incoming),
        PROCESSES: formatProcesses(processes),
    });
    const response = await deps.invokeLLM(prompt, MODULE_SYSTEM_PROMPT, deps.streamOpts(node.name));
    const pageContent = `# ${node.name}\n\n${response.content}`;
    await fs.writeFile(path.join(deps.wikiDir, `${node.slug}.md`), pageContent, 'utf-8');
}
export async function generateParentPage(node, deps) {
    if (!node.children || node.children.length === 0)
        return;
    const childDocs = [];
    for (const child of node.children) {
        const childPage = path.join(deps.wikiDir, `${child.slug}.md`);
        try {
            const content = await fs.readFile(childPage, 'utf-8');
            const overviewEnd = content.indexOf('### Architecture');
            const overview = overviewEnd > 0 ? content.slice(0, overviewEnd).trim() : content.slice(0, 800).trim();
            childDocs.push(`#### ${child.name}\n${overview}`);
        }
        catch {
            childDocs.push(`#### ${child.name}\n(Documentation not yet generated)`);
        }
    }
    const allChildFiles = node.children.flatMap((c) => c.files);
    const crossCalls = await getIntraModuleCallEdges(allChildFiles);
    const processes = await getProcessesForFiles(allChildFiles, 3);
    const prompt = fillTemplate(PARENT_USER_PROMPT, {
        MODULE_NAME: node.name,
        CHILDREN_DOCS: childDocs.join('\n\n'),
        CROSS_MODULE_CALLS: formatCallEdges(crossCalls),
        CROSS_PROCESSES: formatProcesses(processes),
    });
    const response = await deps.invokeLLM(prompt, PARENT_SYSTEM_PROMPT, deps.streamOpts(node.name));
    const pageContent = `# ${node.name}\n\n${response.content}`;
    await fs.writeFile(path.join(deps.wikiDir, `${node.slug}.md`), pageContent, 'utf-8');
}
export async function generateOverview(moduleTree, deps) {
    const moduleSummaries = [];
    for (const node of moduleTree) {
        const pagePath = path.join(deps.wikiDir, `${node.slug}.md`);
        try {
            const content = await fs.readFile(pagePath, 'utf-8');
            const overviewEnd = content.indexOf('### Architecture');
            const overview = overviewEnd > 0 ? content.slice(0, overviewEnd).trim() : content.slice(0, 600).trim();
            moduleSummaries.push(`#### ${node.name}\n${overview}`);
        }
        catch {
            moduleSummaries.push(`#### ${node.name}\n(Documentation pending)`);
        }
    }
    const moduleFiles = extractModuleFiles(moduleTree);
    const moduleEdges = await getInterModuleEdgesForOverview(moduleFiles);
    const topProcesses = await getAllProcesses(5);
    const projectInfo = await readProjectInfo(deps.repoPath);
    const edgesText = moduleEdges.length > 0
        ? moduleEdges.map((e) => `${e.from} → ${e.to} (${e.count} calls)`).join('\n')
        : 'No inter-module call edges detected';
    const prompt = fillTemplate(OVERVIEW_USER_PROMPT, {
        PROJECT_INFO: projectInfo,
        MODULE_SUMMARIES: moduleSummaries.join('\n\n'),
        MODULE_EDGES: edgesText,
        TOP_PROCESSES: formatProcesses(topProcesses),
    });
    const response = await deps.invokeLLM(prompt, OVERVIEW_SYSTEM_PROMPT, deps.streamOpts('Generating overview', 88));
    const pageContent = `# ${path.basename(deps.repoPath)} — Wiki\n\n${response.content}`;
    await fs.writeFile(path.join(deps.wikiDir, 'overview.md'), pageContent, 'utf-8');
}
