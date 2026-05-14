import express from 'express';
export declare const SPA_FALLBACK_REGEX: RegExp;
export declare const resolveWebDistDir: () => Promise<string | null>;
export declare const landingPageHtml: () => string;
export declare const staticCacheControlSetHeaders: (res: express.Response, filePath: string) => void;
export declare const registerWebUI: (app: express.Express, staticDir: string | null) => void;
