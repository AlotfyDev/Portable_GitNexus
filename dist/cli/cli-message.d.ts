/**
 * User-facing informational message. Use for banners, listening URLs,
 * and any message the user expects to read in plain text.
 */
export declare function cliInfo(msg: string, fields?: Record<string, unknown>): void;
/**
 * User-facing warning. Operator-actionable but non-fatal — `cliWarn`
 * indicates the command can still proceed in some form.
 */
export declare function cliWarn(msg: string, fields?: Record<string, unknown>): void;
/**
 * User-facing error. Indicates the command cannot proceed; usually
 * paired with a non-zero exit code at the call site.
 */
export declare function cliError(msg: string, fields?: Record<string, unknown>): void;
