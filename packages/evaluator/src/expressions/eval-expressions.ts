/**
 * @author Aidan Boissonneault
 * @file eval-expressions.ts
 * @purpose Dispatches expression evaluation to feature-owned handlers.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  FaceRef,
  IRFontRef,
  IRPlacement,
  PosRef,
} from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalAutoExpr } from './eval-auto-expression.js';
import {
  evalFaceRefExpr,
  evalFaceRefListExpr,
} from '../references/eval-face-expressions.js';
import { type SelectionContext } from '../references/eval-resolved-selection.js';
import { resolveTemplateExpression } from './template/eval-template-expression.js';
import { resolveBinaryExpression } from './binary/eval-binary-expression.js';
import { resolveUnaryExpression } from './unary/eval-unary-expression.js';
import { resolveIdentifier } from './identifier/eval-identifier.js';
import { resolveUnitExpression } from './unit/eval-unit-expression.js';
import { resolveThisExpression } from './this/eval-this-expression.js';
import {
  resolvePlacement,
  resolvePositionPlacement,
  resolveAxisExpression,
} from './placement/eval-placement.js';
import {
  evaluateNumberExpression,
  evaluateStringExpression,
  evaluateFontExpression,
  evaluateBooleanExpression,
} from './values/eval-expression-values.js';

export { evalEnvDecl, unitToMm } from './eval-environment-values.js';
export {
  FACE_WORDS,
  asFaceRefValue,
  evalFaceRefExpr,
  serializeAnchorTarget,
  serializeFaceRef,
  serializeFaceRefSegments,
} from '../references/eval-face-expressions.js';

/**
 * Evaluates expr with the current evaluation context.
 */
export function evalExpr(expr: Expr, ctx: EvalCtx): EvalValue {
  switch (expr.kind) {
    case 'number':
      return expr.value;
    case 'string':
      return expr.value;
    case 'template':
      return resolveTemplateExpression(expr, ctx, evalExpr);
    case 'bool':
      return expr.value;
    case 'list':
      return expr.items.map((item) => evalExpr(item, ctx));
    case 'tuple':
      return [evalNum(expr.x, ctx), evalNum(expr.y, ctx)] as const;
    case 'identifier':
      return resolveIdentifier(expr, ctx);
    case 'binary':
      return resolveBinaryExpression(expr, ctx, evalExpr);
    case 'unary':
      return resolveUnaryExpression(expr, ctx, evalExpr);
    case 'ternary':
      return evalExpr(expr.condition, ctx)
        ? evalExpr(expr.then, ctx)
        : evalExpr(expr.else, ctx);
    case 'unit':
      return resolveUnitExpression(expr, ctx, evalNum);
    case 'this':
      return resolveThisExpression(expr, ctx);
    case 'faceRef':
      return evalFaceRefExpr(expr, ctx);
    case 'faceRefList':
      return evalFaceRefListExpr(expr, ctx);
    case 'pos':
      return resolvePositionPlacement(expr, ctx, evalNum);
    case 'call':
      addError(ctx, `User-defined function calls not yet supported`, expr.span);
      return 0;
    case 'auto':
      return evalAutoExpr(expr, ctx);
  }
  return 0;
}

/** Evaluates a face or position reference as an IR placement. */
export function evalPlacement(
  ref: FaceRef | PosRef,
  ctx: EvalCtx,
  selectionContext: SelectionContext = 'placement',
): IRPlacement {
  return resolvePlacement(ref, ctx, evalNum, selectionContext);
}

/** Evaluates a position reference as an IR placement. */
export function evalPosToPlacement(
  ref: PosRef,
  ctx: EvalCtx,
  selectionContext: SelectionContext = 'placement',
): IRPlacement {
  return resolvePositionPlacement(ref, ctx, evalNum, selectionContext);
}

/** Resolves auto within an x or y placement expression. */
export function evalAxisExpr(
  expr: Expr,
  axis: 'x' | 'y',
  ctx: EvalCtx,
): number {
  return resolveAxisExpression(expr, axis, ctx, evalNum);
}

/** Evaluates a finite numeric expression. */
export function evalNum(expr: Expr, ctx: EvalCtx): number {
  return evaluateNumberExpression(expr, ctx, evalExpr);
}

/** Evaluates an expression as a string. */
export function evalStr(expr: Expr, ctx: EvalCtx): string {
  return evaluateStringExpression(expr, ctx, evalExpr);
}

/** Evaluates an expression as a font reference. */
export function evalFont(expr: Expr | undefined, ctx: EvalCtx): IRFontRef {
  return evaluateFontExpression(expr, ctx, evalExpr);
}

/** Evaluates an expression as a boolean. */
export function evalBool(expr: Expr, ctx: EvalCtx): boolean {
  return evaluateBooleanExpression(expr, ctx, evalExpr);
}
