// Dart queries - works with tree-sitter-dart (UserNobody14/tree-sitter-dart, ABI 14)
// Note: Dart grammar has function_signature/method_signature as wrappers;
// top-level functions are (program > function_signature),
// methods inside classes are (method_signature > function_signature).
// We match top-level functions via (program (function_signature ...)) to avoid
// double-counting methods that also contain function_signature.
export const DART_QUERIES = `
; ── Classes ──────────────────────────────────────────────────────────────────
(class_definition
  name: (identifier) @name) @definition.class

; ── Mixins ───────────────────────────────────────────────────────────────────
(mixin_declaration
  (identifier) @name) @definition.trait

; ── Extensions ───────────────────────────────────────────────────────────────
(extension_declaration
  name: (identifier) @name) @definition.class

; ── Enums ────────────────────────────────────────────────────────────────────
(enum_declaration
  name: (identifier) @name) @definition.enum

; ── Type aliases ─────────────────────────────────────────────────────────────
; Anchor "=" after the name to avoid capturing the RHS type
(type_alias
  (type_identifier) @name
  "=") @definition.type

; ── Top-level functions (parent is program, not method_signature) ────────────
(program
  (function_signature
    name: (identifier) @name) @definition.function)

; ── Abstract method declarations (function_signature inside class body declaration) ──
(declaration
  (function_signature
    name: (identifier) @name)) @definition.method

; ── Methods (inside class/mixin/extension bodies) ────────────────────────────
(method_signature
  (function_signature
    name: (identifier) @name)) @definition.method

; ── Constructors ─────────────────────────────────────────────────────────────
(constructor_signature
  name: (identifier) @name) @definition.constructor

; ── Factory constructors (anchor before param list to capture variant name, not class) ──
(method_signature
  (factory_constructor_signature
    (identifier) @name . (formal_parameter_list))) @definition.constructor

; ── Field declarations (String name = '', Address address = Address()) ──────
(declaration
  (type_identifier)
  (initialized_identifier_list
    (initialized_identifier
      (identifier) @name))) @definition.property

; ── Nullable field declarations (String? name) ──────────────────────────────
(declaration
  (nullable_type)
  (initialized_identifier_list
    (initialized_identifier
      (identifier) @name))) @definition.property

; ── Getters ──────────────────────────────────────────────────────────────────
(method_signature
  (getter_signature
    name: (identifier) @name)) @definition.property

; ── Setters ──────────────────────────────────────────────────────────────────
(method_signature
  (setter_signature
    name: (identifier) @name)) @definition.property

; ── Top-level variable declarations (const maxSize = 100, final x = 5, var y = 0) ──
(declaration
  (initialized_identifier_list
    (initialized_identifier
      (identifier) @name))) @definition.variable

; ── Imports ──────────────────────────────────────────────────────────────────
(import_or_export
  (library_import
    (import_specification
      (configurable_uri) @import.source))) @import

; ── Calls: direct function/constructor calls (identifier immediately before argument_part) ──
(expression_statement
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Calls: method calls (obj.method()) ───────────────────────────────────────
(expression_statement
  (selector
    (unconditional_assignable_selector
      (identifier) @call.name))) @call

; ── Calls: in return statements (return User()) ─────────────────────────────
(return_statement
  (identifier) @call.name
  (selector (argument_part))) @call

; ── Calls: in variable assignments (var x = getUser()) ──────────────────────
(initialized_variable_definition
  value: (identifier) @call.name
  (selector (argument_part))) @call

; ── Calls: member calls in variable assignments (var x = obj.method()) ──────
(initialized_variable_definition
  (selector
    (unconditional_assignable_selector
      (identifier) @call.name))
  (selector (argument_part))) @call

; ── Calls: await direct (await doSomething()) ────────────────────────────────
(await_expression
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Calls: await method chain (await obj.method()) ───────────────────────────
; Requires argument_part to distinguish method calls from field access (await obj.field)
(await_expression
  (selector
    (unconditional_assignable_selector
      (identifier) @call.name))
  (selector (argument_part))) @call

; ── Calls: named argument (foo(child: buildX())) ─────────────────────────────
(named_argument
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Calls: inside list literals ([buildA(), buildB()]) ───────────────────────
(list_literal
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Calls: cascade (obj..add(x)..sort()) ─────────────────────────────────────
; Note: cascade_selector contains identifier directly (no unconditional_assignable_selector
; wrapper in Dart grammar), so inferCallForm() classifies these as free calls rather than
; member calls. Cross-file resolution still benefits from the call being recorded.
(cascade_section
  (cascade_selector (identifier) @call.name)
  (argument_part)) @call

; ── Calls: static final field initializers (static final _svc = MyService()) ──
(static_final_declaration
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Calls: arrow function body (=> buildWidget()) ────────────────────────────
(function_body "=>"
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Calls: lambda body (() => doSomething()) ─────────────────────────────────
(function_expression_body
  (identifier) @call.name
  .
  (selector (argument_part))) @call

; ── Re-exports (export 'foo.dart') ───────────────────────────────────────────
(import_or_export
  (library_export
    (configurable_uri) @import.source)) @import

; ── Write access: obj.field = value ──────────────────────────────────────────
(assignment_expression
  left: (assignable_expression
    (identifier) @assignment.receiver
    (unconditional_assignable_selector
      (identifier) @assignment.property))
  right: (_)) @assignment

; ── Write access: this.field = value ─────────────────────────────────────────
(assignment_expression
  left: (assignable_expression
    (this) @assignment.receiver
    (unconditional_assignable_selector
      (identifier) @assignment.property))
  right: (_)) @assignment

; ── Heritage: extends ────────────────────────────────────────────────────────
(class_definition
  name: (identifier) @heritage.class
  superclass: (superclass
    (type_identifier) @heritage.extends)) @heritage

; ── Heritage: implements ─────────────────────────────────────────────────────
(class_definition
  name: (identifier) @heritage.class
  interfaces: (interfaces
    (type_identifier) @heritage.implements)) @heritage.impl

; ── Heritage: with (mixins) ──────────────────────────────────────────────────
(class_definition
  name: (identifier) @heritage.class
  superclass: (superclass
    (mixins
      (type_identifier) @heritage.trait))) @heritage
`;
