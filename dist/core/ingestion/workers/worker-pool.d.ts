export interface WorkerPool {
    /**
     * Dispatch items across workers. Items are split into bounded jobs, each job
     * is committed independently, and stalled jobs are split/retried locally.
     */
    dispatch<TInput, TResult>(items: TInput[], onProgress?: (filesProcessed: number) => void): Promise<TResult[]>;
    /** Terminate all workers. Must be called when done. */
    terminate(): Promise<void>;
    /** Number of workers in the pool */
    readonly size: number;
}
export interface WorkerPoolOptions {
    subBatchSize?: number;
    subBatchMaxBytes?: number;
    subBatchIdleTimeoutMs?: number;
    maxTimeoutRetries?: number;
    timeoutBackoffFactor?: number;
}
export declare function resolveWorkerPoolOptions(options?: WorkerPoolOptions): Required<WorkerPoolOptions>;
/**
 * Create a pool of worker threads.
 */
export declare const createWorkerPool: (workerUrl: URL, poolSize?: number, options?: WorkerPoolOptions) => WorkerPool;
