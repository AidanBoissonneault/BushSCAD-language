/**
 * @author Aidan Boissonneault
 * @file eval-body-parent-context.ts
 * @purpose Evaluates body parent context for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ComponentBody,
  ComponentStatement,
  ObjectOperation,
  SketchInput,
  SketchPrimitive,
} from '@bushscad/ir';

/**
 * Detects component geometry that cannot be evaluated at its declaration site.
 *
 * Why:
 * An inset profile derives its dimensions from the face on which a component
 * is placed. Exported components normally render immediately, but a component
 * with this placement-only primitive must remain lazy until that context exists.
 */
export function bodyRequiresParentContext(body: ComponentBody): boolean {
  return body.statements.some(statementRequiresParentContext);
}

/**
 * Handles statement requires parent context in the statements flow.
 */
function statementRequiresParentContext(stmt: ComponentStatement): boolean {
  return STATEMENT_CHECKS[stmt.kind]?.(stmt) ?? false;
}

const STATEMENT_CHECKS: Partial<
  Record<ComponentStatement['kind'], (stmt: ComponentStatement) => boolean>
> = {
  sketch: (stmt) =>
    stmt.kind === 'sketch' && primitiveRequiresParentContext(stmt.primitive),
  obj: (stmt) =>
    stmt.kind === 'obj' && operationRequiresParentContext(stmt.operation),
  anonymousObj: (stmt) =>
    stmt.kind === 'anonymousObj' &&
    operationRequiresParentContext(stmt.operation),
  refObj: (stmt) =>
    stmt.kind === 'refObj' && operationRequiresParentContext(stmt.operation),
  refPart: (stmt) =>
    stmt.kind === 'refPart' && bodyRequiresParentContext(stmt.body),
  fn: (stmt) => stmt.kind === 'fn' && bodyRequiresParentContext(stmt.body),
  return: (stmt) =>
    stmt.kind === 'return' && bodyRequiresParentContext(stmt.body),
  for: (stmt) => stmt.kind === 'for' && bodyRequiresParentContext(stmt.body),
  if: (stmt) => stmt.kind === 'if' && ifRequiresParentContext(stmt),
};

/**
 * Handles if requires parent context in the statements flow.
 */
function ifRequiresParentContext(
  stmt: Extract<ComponentStatement, { kind: 'if' }>,
): boolean {
  return (
    bodyRequiresParentContext(stmt.then) ||
    (stmt.else ? bodyRequiresParentContext(stmt.else) : false)
  );
}

const SKETCH_INPUT_OPERATIONS = new Set<ObjectOperation['kind']>([
  'extrude',
  'cut',
  'revolve',
  'radial_extrude',
  'radial_cut',
  'sweep',
  'sweep_cut',
]);

/**
 * Dispatches the operation to its matching action handler.
 */
function operationRequiresParentContext(op: ObjectOperation): boolean {
  if (SKETCH_INPUT_OPERATIONS.has(op.kind) && 'sketch' in op) {
    return sketchInputRequiresParentContext(op.sketch);
  }
  if (op.kind === 'loft') return loftRequiresParentContext(op);
  return op.kind === 'solid_cut' && op.tool.kind === 'operation'
    ? operationRequiresParentContext(op.tool.operation)
    : false;
}

/**
 * Handles loft requires parent context in the statements flow.
 */
function loftRequiresParentContext(
  op: Extract<ObjectOperation, { kind: 'loft' }>,
): boolean {
  return (
    op.sketches.some(sketchInputRequiresParentContext) ||
    (op.guide ? sketchInputRequiresParentContext(op.guide) : false)
  );
}

/**
 * Handles sketch input requires parent context in the statements flow.
 */
function sketchInputRequiresParentContext(input: SketchInput): boolean {
  if (input.kind === 'inlineSketch') {
    return primitiveRequiresParentContext(input.primitive);
  }
  if (input.kind === 'sketchList') {
    return input.items.some(sketchInputRequiresParentContext);
  }
  return false;
}

/**
 * Builds the primitive data required by the current operation.
 */
function primitiveRequiresParentContext(prim: SketchPrimitive): boolean {
  if (prim.kind === 'inset') return true;
  if (prim.kind === 'sketchBoolean') {
    return (
      primitiveRequiresParentContext(prim.left) ||
      primitiveRequiresParentContext(prim.right)
    );
  }
  return 'primitive' in prim
    ? primitiveRequiresParentContext(prim.primitive)
    : false;
}
