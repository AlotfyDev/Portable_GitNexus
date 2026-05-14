import fs from 'fs/promises';
import path from 'path';

import {
  initWikiDb,
  closeWikiDb,
  touchWikiDb,
  getFilesWithExports,
  getAllFiles,
  getIntraModuleCallEdges,
  getInterModuleCallEdges,
  getProcessesForFiles,
  getInterModuleEdgesForOverview,
  type FileWithExports,
} from '../graph-queries.js';

import {
  callLLM,
  type LLMConfig,
  type CallLLMOptions,
  type LLMResponse,
} from '../llm-client.js';

import { callCursorLLM, resolveCursorConfig } from '../cursor-client.js';

import {
  GROUPING_SYSTEM_PROMPT,
  GROUPING_USER_PROMPT,
  fillTemplate,
  formatFileListForGrouping,
  formatDirectoryTree,
} from '../prompts.js';

import { shouldIgnorePath } from '../../../config/ignore-service.js';

import type {
  WikiOptions,
  WikiMeta,
  ModuleTreeNode,
  ProgressCallback,
  WikiRunResult,
} from './types.js';
import { WIKI_DIR, DEFAULT_MAX_TOKENS_PER_MODULE } from './constants.js';

import {
  fileExists,
  getCurrentCommit,
  getChangedFiles,
  readSourceFiles,
  estimateModuleTokens,
  loadWikiMeta,
  saveWikiMeta,
  saveModuleTree,
  runParallel,
  ensureHTMLViewer,
} from './helpers/file-utils.js';

import {
  parseGroupingResponse,
  fallbackGrouping,
  splitBySubdirectory,
  extractModuleFiles,
  countModules,
  flattenModuleTree,
  findNodeBySlug,
  slugify,
} from './helpers/tree-builder.js';

import {
  generateLeafPage,
  generateParentPage,
  generateOverview,
  type PageGenDeps,
} from './helpers/markdown.js';

export class WikiGenerator {
  private repoPath: string;
  private storagePath: string;
  private wikiDir: string;
  private lbugPath: string;
  private llmConfig: LLMConfig;
  private maxTokensPerModule: number;
  private concurrency: number;
  private options: WikiOptions;
  private onProgress: ProgressCallback;
  private failedModules: string[] = [];

  private lastPercent: { value: number } = { value: 0 };

  constructor(
    repoPath: string,
    storagePath: string,
    lbugPath: string,
    llmConfig: LLMConfig,
    options: WikiOptions = {},
    onProgress?: ProgressCallback,
  ) {
    this.repoPath = repoPath;
    this.storagePath = storagePath;
    this.wikiDir = path.join(storagePath, WIKI_DIR);
    this.lbugPath = lbugPath;
    this.options = options;
    this.llmConfig = llmConfig;
    this.maxTokensPerModule = options.maxTokensPerModule ?? DEFAULT_MAX_TOKENS_PER_MODULE;
    this.concurrency = options.concurrency ?? 3;
    const progressFn = onProgress || (() => {});
    this.onProgress = (phase, percent, detail) => {
      if (percent > 0) this.lastPercent.value = percent;
      progressFn(phase, percent, detail);
    };
  }

  private streamOpts(label: string, fixedPercent?: number, percentRange = 10): CallLLMOptions {
    const hasFixedStart = fixedPercent !== undefined;
    const startPercent = fixedPercent ?? this.lastPercent.value;
    const expectedTokens = 2000;
    let lastTouch = Date.now();

    return {
      onChunk: (chars: number) => {
        const tokens = Math.round(chars / 4);

        if (hasFixedStart) {
          const progress = Math.min(1, tokens / expectedTokens);
          const pct = Math.round(startPercent + progress * percentRange);
          this.onProgress('stream', pct, `${label} (${tokens} tok)`);
        } else {
          this.onProgress('stream', this.lastPercent.value, `${label} (${tokens} tok)`);
        }

        const now = Date.now();
        if (now - lastTouch > 60_000) {
          touchWikiDb();
          lastTouch = now;
        }
      },
    };
  }

  private async invokeLLM(
    prompt: string,
    systemPrompt: string,
    options?: CallLLMOptions,
  ): Promise<LLMResponse> {
    if (this.llmConfig.provider === 'cursor') {
      const cursorConfig = resolveCursorConfig({
        model: this.llmConfig.model,
        workingDirectory: this.repoPath,
      });
      return callCursorLLM(prompt, cursorConfig, systemPrompt, options);
    }
    return callLLM(prompt, this.llmConfig, systemPrompt, options);
  }

  async run(): Promise<WikiRunResult> {
    await fs.mkdir(this.wikiDir, { recursive: true });

    const existingMeta = await loadWikiMeta(this.wikiDir);
    const currentCommit = getCurrentCommit(this.repoPath);
    const forceMode = this.options.force;

    if (!forceMode && existingMeta && existingMeta.fromCommit === currentCommit) {
      await ensureHTMLViewer(this.wikiDir, this.repoPath, this.onProgress);
      return { pagesGenerated: 0, mode: 'up-to-date', failedModules: [] };
    }

    if (forceMode) {
      try {
        await fs.unlink(path.join(this.wikiDir, 'first_module_tree.json'));
      } catch {}
      const existingFiles = await fs.readdir(this.wikiDir).catch(() => [] as string[]);
      for (const f of existingFiles) {
        if (f.endsWith('.md')) {
          try {
            await fs.unlink(path.join(this.wikiDir, f));
          } catch {}
        }
      }
    }

    this.onProgress('init', 2, 'Connecting to knowledge graph...');
    await initWikiDb(this.lbugPath);

    let result: WikiRunResult;
    try {
      if (!forceMode && existingMeta && existingMeta.fromCommit) {
        result = await this.incrementalUpdate(existingMeta, currentCommit);
      } else {
        result = await this.fullGeneration(currentCommit);
      }
    } finally {
      await closeWikiDb();
    }

    await ensureHTMLViewer(this.wikiDir, this.repoPath, this.onProgress);

    return result;
  }

  private async fullGeneration(currentCommit: string): Promise<WikiRunResult> {
    let pagesGenerated = 0;

    this.onProgress('gather', 5, 'Querying graph for file structure...');
    const filesWithExports = await getFilesWithExports();
    const allFiles = await getAllFiles();

    const sourceFiles = allFiles.filter((f) => !shouldIgnorePath(f));
    if (sourceFiles.length === 0) {
      throw new Error('No source files found in the knowledge graph. Nothing to document.');
    }

    const exportMap = new Map(filesWithExports.map((f) => [f.filePath, f]));
    const enrichedFiles: FileWithExports[] = sourceFiles.map((fp) => {
      return exportMap.get(fp) || { filePath: fp, symbols: [] };
    });

    this.onProgress('gather', 10, `Found ${sourceFiles.length} source files`);

    const moduleTree = await this.buildModuleTree(enrichedFiles);
    pagesGenerated = 0;

    if (this.options.reviewOnly) {
      await saveModuleTree(this.wikiDir, moduleTree);
      this.onProgress('review', 30, 'Module tree ready for review');
      const reviewResult: WikiRunResult = {
        pagesGenerated: 0,
        mode: 'full',
        failedModules: [],
        moduleTree,
      };
      return reviewResult;
    }

    const totalModules = countModules(moduleTree);
    let modulesProcessed = 0;

    const reportProgress = (moduleName?: string) => {
      modulesProcessed++;
      const percent = 30 + Math.round((modulesProcessed / totalModules) * 55);
      const detail = moduleName
        ? `${modulesProcessed}/${totalModules} — ${moduleName}`
        : `${modulesProcessed}/${totalModules} modules`;
      this.onProgress('modules', percent, detail);
    };

    const { leaves, parents } = flattenModuleTree(moduleTree);

    const deps: PageGenDeps = {
      wikiDir: this.wikiDir,
      repoPath: this.repoPath,
      maxTokensPerModule: this.maxTokensPerModule,
      invokeLLM: this.invokeLLM.bind(this),
      streamOpts: this.streamOpts.bind(this),
    };

    pagesGenerated += await runParallel(leaves, async (node) => {
      const pagePath = path.join(this.wikiDir, `${node.slug}.md`);
      if (await fileExists(pagePath)) {
        reportProgress(node.name);
        return 0;
      }
      try {
        await generateLeafPage(node, deps);
        reportProgress(node.name);
        return 1;
      } catch (err: any) {
        this.failedModules.push(node.name);
        reportProgress(`Failed: ${node.name}`);
        return 0;
      }
    }, this.concurrency, this.onProgress, this.lastPercent);

    for (const node of parents) {
      const pagePath = path.join(this.wikiDir, `${node.slug}.md`);
      if (await fileExists(pagePath)) {
        reportProgress(node.name);
        continue;
      }
      try {
        await generateParentPage(node, deps);
        pagesGenerated++;
        reportProgress(node.name);
      } catch (err: any) {
        this.failedModules.push(node.name);
        reportProgress(`Failed: ${node.name}`);
      }
    }

    this.onProgress('overview', 88, 'Generating overview page...');
    await generateOverview(moduleTree, deps);
    pagesGenerated++;

    this.onProgress('finalize', 95, 'Saving metadata...');
    const moduleFiles = extractModuleFiles(moduleTree);
    await saveModuleTree(this.wikiDir, moduleTree);
    await saveWikiMeta(this.wikiDir, {
      fromCommit: currentCommit,
      generatedAt: new Date().toISOString(),
      model: this.llmConfig.model,
      moduleFiles,
      moduleTree,
    });

    this.onProgress('done', 100, 'Wiki generation complete');
    return { pagesGenerated, mode: 'full', failedModules: [...this.failedModules] };
  }

  private async buildModuleTree(files: FileWithExports[]): Promise<ModuleTreeNode[]> {
    const editablePath = path.join(this.wikiDir, 'module_tree.json');
    try {
      const edited = await fs.readFile(editablePath, 'utf-8');
      const parsed = JSON.parse(edited);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.onProgress('grouping', 25, 'Using edited module tree');
        return parsed;
      }
    } catch {
    }

    const snapshotPath = path.join(this.wikiDir, 'first_module_tree.json');
    try {
      const existing = await fs.readFile(snapshotPath, 'utf-8');
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length > 0) {
        this.onProgress('grouping', 25, 'Using existing module tree (resuming)');
        return parsed;
      }
    } catch {
    }

    this.onProgress('grouping', 15, 'Grouping files into modules (LLM)...');

    const fileList = formatFileListForGrouping(files);
    const dirTree = formatDirectoryTree(files.map((f) => f.filePath));

    const prompt = fillTemplate(GROUPING_USER_PROMPT, {
      FILE_LIST: fileList,
      DIRECTORY_TREE: dirTree,
    });

    const response = await this.invokeLLM(
      prompt,
      GROUPING_SYSTEM_PROMPT,
      this.streamOpts('Grouping files', 15, 13),
    );
    const grouping = parseGroupingResponse(response.content, files);

    const tree: ModuleTreeNode[] = [];
    for (const [moduleName, modulePaths] of Object.entries(grouping)) {
      const slug = slugify(moduleName);
      const node: ModuleTreeNode = { name: moduleName, slug, files: modulePaths };

      const totalTokens = await estimateModuleTokens(this.repoPath, modulePaths);
      if (totalTokens > this.maxTokensPerModule && modulePaths.length > 3) {
        const children = splitBySubdirectory(moduleName, modulePaths);
        if (children.length > 1) {
          node.children = children;
          node.files = [];
        }
      }

      tree.push(node);
    }

    await fs.writeFile(snapshotPath, JSON.stringify(tree, null, 2), 'utf-8');
    this.onProgress('grouping', 28, `Created ${tree.length} modules`);

    return tree;
  }

  private async incrementalUpdate(
    existingMeta: WikiMeta,
    currentCommit: string,
  ): Promise<WikiRunResult> {
    this.onProgress('incremental', 5, 'Detecting changes...');

    const changedFiles = getChangedFiles(this.repoPath, existingMeta.fromCommit, currentCommit);

    if (changedFiles === null) {
      this.onProgress('incremental', 10, 'Branch diverged, running full generation...');
      const fullResult = await this.fullGeneration(currentCommit);
      return { ...fullResult, mode: 'incremental' };
    }

    if (changedFiles.length === 0) {
      await saveWikiMeta(this.wikiDir, {
        ...existingMeta,
        fromCommit: currentCommit,
        generatedAt: new Date().toISOString(),
      });
      return { pagesGenerated: 0, mode: 'incremental', failedModules: [] };
    }

    this.onProgress('incremental', 10, `${changedFiles.length} files changed`);

    const affectedModules = new Set<string>();
    const newFiles: string[] = [];

    for (const fp of changedFiles) {
      let found = false;
      for (const [mod, files] of Object.entries(existingMeta.moduleFiles)) {
        if (files.includes(fp)) {
          affectedModules.add(mod);
          found = true;
          break;
        }
      }
      if (!found && !shouldIgnorePath(fp)) {
        newFiles.push(fp);
      }
    }

    if (newFiles.length > 5) {
      this.onProgress(
        'incremental',
        15,
        'Significant new files detected, running full generation...',
      );
      try {
        await fs.unlink(path.join(this.wikiDir, 'first_module_tree.json'));
      } catch {}
      const fullResult = await this.fullGeneration(currentCommit);
      return { ...fullResult, mode: 'incremental' };
    }

    if (newFiles.length > 0) {
      if (!existingMeta.moduleFiles['Other']) {
        existingMeta.moduleFiles['Other'] = [];
      }
      existingMeta.moduleFiles['Other'].push(...newFiles);
      affectedModules.add('Other');
    }

    let pagesGenerated = 0;
    const moduleTree = existingMeta.moduleTree;
    const affectedArray = Array.from(affectedModules);

    this.onProgress('incremental', 20, `Regenerating ${affectedArray.length} module(s)...`);

    const affectedNodes: ModuleTreeNode[] = [];
    for (const mod of affectedArray) {
      const modSlug = slugify(mod);
      const node = findNodeBySlug(moduleTree, modSlug);
      if (node) {
        try {
          await fs.unlink(path.join(this.wikiDir, `${node.slug}.md`));
        } catch {}
        affectedNodes.push(node);
      }
    }

    const deps: PageGenDeps = {
      wikiDir: this.wikiDir,
      repoPath: this.repoPath,
      maxTokensPerModule: this.maxTokensPerModule,
      invokeLLM: this.invokeLLM.bind(this),
      streamOpts: this.streamOpts.bind(this),
    };

    let incProcessed = 0;
    pagesGenerated += await runParallel(affectedNodes, async (node) => {
      try {
        if (node.children && node.children.length > 0) {
          await generateParentPage(node, deps);
        } else {
          await generateLeafPage(node, deps);
        }
        incProcessed++;
        const percent = 20 + Math.round((incProcessed / affectedNodes.length) * 60);
        this.onProgress(
          'incremental',
          percent,
          `${incProcessed}/${affectedNodes.length} — ${node.name}`,
        );
        return 1;
      } catch (err: any) {
        this.failedModules.push(node.name);
        incProcessed++;
        return 0;
      }
    }, this.concurrency, this.onProgress, this.lastPercent);

    if (pagesGenerated > 0) {
      this.onProgress('incremental', 85, 'Updating overview...');
      await generateOverview(moduleTree, deps);
      pagesGenerated++;
    }

    this.onProgress('incremental', 95, 'Saving metadata...');
    await saveWikiMeta(this.wikiDir, {
      ...existingMeta,
      fromCommit: currentCommit,
      generatedAt: new Date().toISOString(),
      model: this.llmConfig.model,
    });

    this.onProgress('done', 100, 'Incremental update complete');
    return { pagesGenerated, mode: 'incremental', failedModules: [...this.failedModules] };
  }
}
