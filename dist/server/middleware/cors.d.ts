import type { Request, Response, NextFunction } from 'express';
import type { ServerConfig } from '../config.js';
export declare const isAllowedOrigin: (origin: string | undefined) => boolean;
export declare function corsMiddleware(config: ServerConfig): (req: Request, res: Response, next: NextFunction) => void;
