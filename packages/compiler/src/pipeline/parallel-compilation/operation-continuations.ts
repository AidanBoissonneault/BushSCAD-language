/**
 * @author Aidan Boissonneault
 * @file operation-continuations.ts
 * @purpose Provides operation continuations behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp } from '@bushscad/ir';
import { operationAccess } from '@bushscad/evaluator';

/**
 * Identifies concrete IR nodes that may discover work after geometry completes.
 * The static operation table is deliberately conservative. Once values
 * and branches are evaluated, ordinary fuses, world transforms, literal
 * assertions, and heals have complete task shapes and need dependency edges,
 * not resumable continuation boundaries.
 */
export function operationNeedsContinuation(op: IROp): boolean {
  if (!operationAccess(op).continuation) return false;
  switch (op.kind) {
    case 'fuse':
    case 'heal':
      return false;
    case 'rotate':
      return typeof op.around !== 'string';
    case 'mirror':
      return op.across.kind !== 'world';
    case 'transform':
      return (
        op.operation.kind === 'rotate' &&
        typeof op.operation.around !== 'string'
      );
    case 'assert':
      return (
        expressionHasGeometryQuery(op.left) ||
        expressionHasGeometryQuery(op.right)
      );
    default:
      return true;
  }
}

/**
 * Handles expression has geometry query in the pipeline parallel compilation flow.
 */
function expressionHasGeometryQuery(
  expression: Extract<IROp, { kind: 'assert' }>['left'] | undefined,
): boolean {
  if (!expression) return false;
  if (expression.kind === 'query') return true;
  if (expression.kind !== 'binary') return false;
  return (
    expressionHasGeometryQuery(expression.left) ||
    expressionHasGeometryQuery(expression.right)
  );
}
