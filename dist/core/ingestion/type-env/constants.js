export const FILE_SCOPE = '';
export const NARROWING_BRANCH_TYPES = new Set([
    'when_entry',
    'switch_block_label',
    'if_statement',
    'if_expression',
    'statement_block',
    'control_structure_body',
]);
export const FAST_NULLABLE_KEYWORDS = new Set(['null', 'undefined', 'void', 'None', 'nil']);
export const THIS_RECEIVERS = new Set(['this', 'self', '$this', 'Me']);
export const SKIP_SUBTREE_TYPES = new Set([
    'string',
    'string_literal',
    'string_content',
    'string_fragment',
    'heredoc_body',
    'comment',
    'line_comment',
    'block_comment',
    'number',
    'integer_literal',
    'float_literal',
    'true',
    'false',
    'null',
    'regex',
    'regex_pattern',
]);
export const CLASS_LIKE_TYPES = new Set(['Class', 'Struct', 'Interface']);
export const CONSTRUCTOR_EXPR_TYPES = new Set([
    'new_expression',
    'object_creation_expression',
]);
export const MAX_MRO_DEPTH = 5;
export const MAX_FIXPOINT_ITERATIONS = 10;
