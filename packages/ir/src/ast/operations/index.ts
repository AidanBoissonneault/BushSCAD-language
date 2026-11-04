/**
 * Public operation contracts for the AST.
 *
 * Why:
 * The parser and resolver share these discriminated unions while each operation
 * shape stays beside its operation's AST contract.
 */
export * from './inputs.js';
export * from './object-operation.js';
export * from './hardware/spec.js';
export * from './hole/operation.js';
export * from './heatset-insert/operation.js';
export * from './extrude/operation.js';
export * from './cut/operation.js';
export * from './revolve/operation.js';
export * from './radial/operation.js';
export * from './loft/operation.js';
export * from './path/primitive.js';
export * from './sweep/operation.js';
export * from './thicken/operation.js';
