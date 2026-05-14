import type { HeritageExtractionConfig } from '../../heritage-types.js';
/**
 * Go heritage extraction config.
 *
 * Go struct embedding: the tree-sitter query matches ALL field_declarations
 * with type_identifier, but only anonymous fields (no name) are embedded.
 * Named fields like `Breed string` also match — skip them.
 *
 * The shouldSkipExtends hook checks if the extends node's parent is a
 * field_declaration with a named field child, indicating a regular
 * (non-embedded) field that should not produce a heritage record.
 */
export declare const goHeritageConfig: HeritageExtractionConfig;
