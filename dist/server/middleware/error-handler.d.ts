import type { Request, Response, NextFunction } from 'express';
export declare const statusFromError: (err: any) => number;
export declare const globalErrorHandler: (err: any, _req: Request, res: Response, _next: NextFunction) => void;
