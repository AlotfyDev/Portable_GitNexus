// Go queries - works with tree-sitter-go
export const GO_QUERIES = `
; Functions & Methods
(function_declaration name: (identifier) @name) @definition.function
(method_declaration name: (field_identifier) @name) @definition.method

; Types
(type_declaration (type_spec name: (type_identifier) @name type: (struct_type))) @definition.struct
(type_declaration (type_spec name: (type_identifier) @name type: (interface_type))) @definition.interface

; Imports
(import_declaration (import_spec path: (interpreted_string_literal) @import.source)) @import
(import_declaration (import_spec_list (import_spec path: (interpreted_string_literal) @import.source))) @import

; Struct fields — named field declarations inside struct types
(field_declaration_list
  (field_declaration
    name: (field_identifier) @name) @definition.property)

; Struct embedding (anonymous fields = inheritance)
(type_declaration
  (type_spec
    name: (type_identifier) @heritage.class
    type: (struct_type
      (field_declaration_list
        (field_declaration
          type: (type_identifier) @heritage.extends))))) @definition.struct

; Calls
(call_expression function: (identifier) @call.name) @call
(call_expression function: (selector_expression field: (field_identifier) @call.name)) @call

; Const/var declarations
(const_declaration (const_spec name: (identifier) @name)) @definition.const
(var_declaration (var_spec name: (identifier) @name)) @definition.variable

; Short variable declaration: x := 5
(short_var_declaration left: (expression_list (identifier) @name)) @definition.variable

; Struct literal construction: User{Name: "Alice"}
(composite_literal type: (type_identifier) @call.name) @call

; Write access: obj.field = value
(assignment_statement
  left: (expression_list
    (selector_expression
      operand: (_) @assignment.receiver
      field: (field_identifier) @assignment.property))
  right: (_)) @assignment

; Write access: obj.field++ / obj.field--
(inc_statement
  (selector_expression
    operand: (_) @assignment.receiver
    field: (field_identifier) @assignment.property)) @assignment
(dec_statement
  (selector_expression
    operand: (_) @assignment.receiver
    field: (field_identifier) @assignment.property)) @assignment
`;
