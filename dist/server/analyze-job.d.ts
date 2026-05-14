/**
 * Analyze Job Manager
 *
 * Tracks server-side analysis jobs with:
 * - In-memory Map storage
 * - Single-slot concurrency (one active job at a time)
 * - Same-repo deduplication (returns existing job)
 * - Progress event emission for SSE relay
 * - 1-hour TTL cleanup for completed/failed jobs
 */
import type { ChildProcess } from 'child_process';
export interface AnalyzeJobProgress {
    phase: string;
    percent: number;
    message: string;
}
export interface AnalyzeJob {
    id: string;
    status: 'queued' | 'cloning' | 'analyzing' | 'loading' | 'complete' | 'failed';
    repoUrl?: string;
    repoPath?: string;
    repoName?: string;
    progress: AnalyzeJobProgress;
    error?: string;
    startedAt: number;
    completedAt?: number;
    /** Number of times the worker has been retried after a crash. */
    retryCount: number;
}
export declare class JobManager {
    private jobs;
    private children;
    private timeouts;
    private emitter;
    private cleanupTimer;
    constructor();
    /** Create a new job, or return existing active job for the same repo. */
    createJob(params: {
        repoUrl?: string;
        repoPath?: string;
    }): AnalyzeJob;
    getJob(id: string): AnalyzeJob | undefined;
    /** Return a snapshot of all tracked jobs for inspection. */
    listJobs(): AnalyzeJob[];
    updateJob(id: string, update: Partial<Pick<AnalyzeJob, 'status' | 'progress' | 'error' | 'repoPath' | 'repoName' | 'completedAt'>>): void;
    /** Register a child process for a job — enables cancellation and timeout. */
    registerChild(jobId: string, child: ChildProcess): void;
    /** Cancel a running job — sends SIGTERM to child process. */
    cancelJob(jobId: string, reason?: string): boolean;
    /** Subscribe to progress events for a job. Returns unsubscribe function. */
    onProgress(jobId: string, listener: (progress: AnalyzeJobProgress) => void): () => void;
    dispose(): void;
    private isTerminal;
    private cleanup;
}
