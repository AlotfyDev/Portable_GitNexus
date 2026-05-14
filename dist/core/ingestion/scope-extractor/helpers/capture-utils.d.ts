import type { CaptureMatch, Range } from '../../../../_shared/index.js';
export declare function rangesEqual(a: Range, b: Range): boolean;
export declare function anchorCaptureFor(match: CaptureMatch, prefix: string): {
    readonly name: string;
    readonly range: Range;
    readonly text: string;
} | undefined;
