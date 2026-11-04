/**
 * @author Aidan Boissonneault
 * @file ast.ts
 * @purpose Provides ast behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

/**
 * Abstract Syntax Tree public API.
 * The parser emits these nodes and the resolver consumes them. This barrel keeps
 * the previous `./ast.js` import path stable while the AST types live in smaller
 * files grouped by concern.
 */
export * from './sourceSpan.js';
export * from './expressions.js';
export * from './pathBodyExpressions.js';
export * from './sketchDeclarations.js';
export * from './sketchPrimitiveTraversal.js';
export * from './sketchPrimitives.js';
export * from './sketchAnnotations.js';
export * from './solidPrimitives.js';
export * from './operations/index.js';
export * from './details.js';
export * from './placement.js';
export * from './declarations.js';
export * from './control-flow.js';
export * from './drawing.js';
export * from './surface.js';
