// TypeScript queries - works with tree-sitter-typescript
export const TYPESCRIPT_QUERIES = `
(class_declaration
  name: (type_identifier) @name) @definition.class

(abstract_class_declaration
  name: (type_identifier) @name) @definition.class

(interface_declaration
  name: (type_identifier) @name) @definition.interface

(function_declaration
  name: (identifier) @name) @definition.function

; TypeScript overload signatures (function_signature is a separate node type from function_declaration)
(function_signature
  name: (identifier) @name) @definition.function

(method_definition
  name: (property_identifier) @name) @definition.method

; ES2022 #private methods (private_property_identifier not matched by property_identifier)
(method_definition
  name: (private_property_identifier) @name) @definition.method

; Abstract method signatures in abstract classes
(abstract_method_signature
  name: (property_identifier) @name) @definition.method

; Interface method signatures
(method_signature
  name: (property_identifier) @name) @definition.method

(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (arrow_function))) @definition.function

(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (function_expression))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (arrow_function)))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (function_expression)))) @definition.function

; Object-property arrows / function expressions: \`{ addItem: () => ... }\`.
; The pair's key field carries the meaningful name. Without these patterns,
; calls inside the arrow are attributed to the file (issue #1166), and the
; arrow itself is invisible to context() / impact() despite carrying real
; behaviour (Zustand actions, TanStack queryFn, React Context providers).
; String-key variant covers \`"add-item": () => ...\`; computed keys
; (\`[K]: () => ...\`) intentionally fall through anonymous.
(pair
  key: (property_identifier) @name
  value: (arrow_function)) @definition.function

(pair
  key: (property_identifier) @name
  value: (function_expression)) @definition.function

(pair
  key: (string (string_fragment) @name)
  value: (arrow_function)) @definition.function

(pair
  key: (string (string_fragment) @name)
  value: (function_expression)) @definition.function

; HOC-wrapped variable declarations: \`const X = HOC((args) => { ... })\`.
; Mirrors the registry-primary patterns in \`languages/typescript/query.ts\`
; so the legacy Call-Resolution DAG and the registry-primary pipeline
; produce the same set of \`Function\` nodes — required for the CI parity
; gate. Covers React.forwardRef / memo / useCallback / useMemo / observer
; / debounce / user-defined HOC factories. The \`var X = HOC(...)\` form is
; mirrored too (registry-primary has it) so that codebases mixing \`var\` and
; \`const\` see identical attribution on both pipelines. See
; \`tsExtractFunctionName\` for the resolution logic and the \`query.ts\`
; comment for the full anchor-discipline rationale and the chained-
; array-method trade-off.
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (arrow_function))))) @definition.function

(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (function_expression))))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (call_expression
        arguments: (arguments
          (arrow_function)))))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (call_expression
        arguments: (arguments
          (function_expression)))))) @definition.function

; \`var X = HOC(...)\` parity with registry-primary. Legacy code (and any
; transpiler output that downlevels \`const\` to \`var\`) hits this shape.
(variable_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (arrow_function))))) @definition.function

(variable_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (function_expression))))) @definition.function

; Variable/constant declarations (non-function values).
; Overlap with @definition.function patterns is handled by parse-worker dedup.
(lexical_declaration
  (variable_declarator
    name: (identifier) @name)) @definition.const

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name))) @definition.const

; var declarations (mutable, function-scoped)
(variable_declaration
  (variable_declarator
    name: (identifier) @name)) @definition.variable

(import_statement
  source: (string) @import.source) @import

; Re-export statements: export { X } from './y'
(export_statement
  source: (string) @import.source) @import

(call_expression
  function: (identifier) @call.name) @call

(call_expression
  function: (member_expression
    property: (property_identifier) @call.name)) @call

; Generic awaited free call: await fn<T>(args)
; tree-sitter-typescript parses "await fn<T>(args)" as a call_expression whose
; "function" field is an await_expression (not a bare identifier), because the
; grammar resolves the ambiguity between generics and comparisons by consuming
; "await fn" as an expression before attaching <T> as type_arguments.
(call_expression
  function: (await_expression
    (identifier) @call.name)
  (type_arguments)) @call

; Generic awaited member call: await obj.fn<T>(args)
(call_expression
  function: (await_expression
    (member_expression
      property: (property_identifier) @call.name))
  (type_arguments)) @call

; Constructor calls: new Foo()
(new_expression
  constructor: (identifier) @call.name) @call

; Class properties — public_field_definition covers most TS class fields
(public_field_definition
  name: (property_identifier) @name) @definition.property

; Private class fields: #address: Address
(public_field_definition
  name: (private_property_identifier) @name) @definition.property

; Constructor parameter properties: constructor(public address: Address)
(required_parameter
  (accessibility_modifier)
  pattern: (identifier) @name) @definition.property

; Heritage queries - class extends
(class_declaration
  name: (type_identifier) @heritage.class
  (class_heritage
    (extends_clause
      value: (identifier) @heritage.extends))) @heritage

; Heritage queries - class implements interface
(class_declaration
  name: (type_identifier) @heritage.class
  (class_heritage
    (implements_clause
      (type_identifier) @heritage.implements))) @heritage.impl

; Write access: obj.field = value
(assignment_expression
  left: (member_expression
    object: (_) @assignment.receiver
    property: (property_identifier) @assignment.property)
  right: (_)) @assignment

; Write access: obj.field += value (compound assignment)
(augmented_assignment_expression
  left: (member_expression
    object: (_) @assignment.receiver
    property: (property_identifier) @assignment.property)
  right: (_)) @assignment

; HTTP consumers: fetch('/path'), axios.get('/path'), $.get('/path'), etc.
; fetch() — global function
(call_expression
  function: (identifier) @_fetch_fn (#eq? @_fetch_fn "fetch")
  arguments: (arguments
    [(string (string_fragment) @route.url)
     (template_string) @route.template_url])) @route.fetch

; axios.get/post/put/delete/patch('/path'), $.get/post/ajax({url:'/path'})
(call_expression
  function: (member_expression
    property: (property_identifier) @http_client.method)
  arguments: (arguments
    (string (string_fragment) @http_client.url))) @http_client

; Decorators: @Controller, @Get, @Post, etc.
(decorator
  (call_expression
    function: (identifier) @decorator.name
    arguments: (arguments (string (string_fragment) @decorator.arg)?))) @decorator

; Express/Hono route registration: app.get('/path', handler), router.post('/path', fn)
(call_expression
  function: (member_expression
    property: (property_identifier) @express_route.method)
  arguments: (arguments
    (string (string_fragment) @express_route.path))) @express_route
`;
// JavaScript queries - works with tree-sitter-javascript
export const JAVASCRIPT_QUERIES = `
(class_declaration
  name: (identifier) @name) @definition.class

(function_declaration
  name: (identifier) @name) @definition.function

(method_definition
  name: (property_identifier) @name) @definition.method

; ES2022 #private methods
(method_definition
  name: (private_property_identifier) @name) @definition.method

(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (arrow_function))) @definition.function

(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (function_expression))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (arrow_function)))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (function_expression)))) @definition.function

; Object-property arrows / function expressions: \`{ addItem: () => ... }\`.
; See TYPESCRIPT_QUERIES for rationale (issue #1166).
(pair
  key: (property_identifier) @name
  value: (arrow_function)) @definition.function

(pair
  key: (property_identifier) @name
  value: (function_expression)) @definition.function

(pair
  key: (string (string_fragment) @name)
  value: (arrow_function)) @definition.function

(pair
  key: (string (string_fragment) @name)
  value: (function_expression)) @definition.function

; HOC-wrapped variable declarations: \`const X = HOC((args) => { ... })\`.
; See TYPESCRIPT_QUERIES section above for the full rationale (issue #1166
; follow-up — covers forwardRef / memo / useCallback / useMemo / observer
; / debounce / user-defined HOC factories). Both \`const\` and \`var\` forms
; are mirrored so JS code that uses \`var\` (or transpiler output) gets the
; same attribution as the registry-primary path.
(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (arrow_function))))) @definition.function

(lexical_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (function_expression))))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (call_expression
        arguments: (arguments
          (arrow_function)))))) @definition.function

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name
      value: (call_expression
        arguments: (arguments
          (function_expression)))))) @definition.function

; \`var X = HOC(...)\` parity with registry-primary.
(variable_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (arrow_function))))) @definition.function

(variable_declaration
  (variable_declarator
    name: (identifier) @name
    value: (call_expression
      arguments: (arguments
        (function_expression))))) @definition.function

; Variable/constant declarations (non-function values).
; Overlap with @definition.function patterns is handled by parse-worker dedup.
(lexical_declaration
  (variable_declarator
    name: (identifier) @name)) @definition.const

(export_statement
  declaration: (lexical_declaration
    (variable_declarator
      name: (identifier) @name))) @definition.const

; var declarations (mutable, function-scoped)
(variable_declaration
  (variable_declarator
    name: (identifier) @name)) @definition.variable

(import_statement
  source: (string) @import.source) @import

; Re-export statements: export { X } from './y'
(export_statement
  source: (string) @import.source) @import

(call_expression
  function: (identifier) @call.name) @call

(call_expression
  function: (member_expression
    property: (property_identifier) @call.name)) @call

; Constructor calls: new Foo()
(new_expression
  constructor: (identifier) @call.name) @call

; Class fields — field_definition captures JS class fields (class User { address = ... })
(field_definition
  property: (property_identifier) @name) @definition.property

; Heritage queries - class extends (JavaScript uses different AST than TypeScript)
; In tree-sitter-javascript, class_heritage directly contains the parent identifier
(class_declaration
  name: (identifier) @heritage.class
  (class_heritage
    (identifier) @heritage.extends)) @heritage

; Write access: obj.field = value
(assignment_expression
  left: (member_expression
    object: (_) @assignment.receiver
    property: (property_identifier) @assignment.property)
  right: (_)) @assignment

; Write access: obj.field += value (compound assignment)
(augmented_assignment_expression
  left: (member_expression
    object: (_) @assignment.receiver
    property: (property_identifier) @assignment.property)
  right: (_)) @assignment

; HTTP consumers: fetch('/path'), axios.get('/path'), $.get('/path'), etc.
(call_expression
  function: (identifier) @_fetch_fn (#eq? @_fetch_fn "fetch")
  arguments: (arguments
    [(string (string_fragment) @route.url)
     (template_string) @route.template_url])) @route.fetch

; axios.get/post, $.get/post/ajax
(call_expression
  function: (member_expression
    property: (property_identifier) @http_client.method)
  arguments: (arguments
    (string (string_fragment) @http_client.url))) @http_client

; Express/Hono route registration
(call_expression
  function: (member_expression
    property: (property_identifier) @express_route.method)
  arguments: (arguments
    (string (string_fragment) @express_route.path))) @express_route
`;
