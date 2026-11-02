/**
 * @author Aidan Boissonneault
 * @file eval-sheet-flanges.ts
 * @purpose Evaluates sheet flanges for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FlangeStmt } from '@bushscad/ir';

import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import type {
  EdgeName,
  RectDims,
  ResolvedFlange,
} from './eval-sheet-geometry.js';

/**
 * Resolve ctx, including thickness, default radius, k factor, panel sketch, and rect dims.
 */
export type ResolveCtx = {
  thickness: number;
  defaultRadius: number;
  kFactor: number;
  panelSketch: Map<string, string>;
  rectDims: Map<string, RectDims>;
  flangesByPanel: Map<string, ResolvedFlange[]>;
};

/**
 * Resolves one sheet flange into validated geometry inputs.
 *
 * The result carries the edge, bend, and wall dimensions needed by panel
 * emission while reporting source-spanned validation errors in the evaluator.
 */
export function resolveFlange(
  stmt: FlangeStmt,
  ctx: EvalCtx,
  rc: ResolveCtx,
): ResolvedFlange | null {
  const sketchName = rc.panelSketch.get(stmt.edgeObj);
  if (sketchName === undefined) {
    addError(ctx, `Unknown base panel '${stmt.edgeObj}' in flange`, stmt.span);
    return null;
  }
  if (rc.rectDims.get(sketchName) === undefined) {
    addError(
      ctx,
      `flange requires a rectangular base panel; '${stmt.edgeObj}' is not built from rect()`,
      stmt.span,
    );
    return null;
  }
  if (!isEdgeName(stmt.edgeName)) {
    addError(
      ctx,
      `Unknown edge '${stmt.edgeName}'. Expected front, back, left, or right`,
      stmt.span,
    );
    return null;
  }

  const length = evalNum(stmt.length, ctx);
  const angleDeg = evalNum(stmt.angle, ctx);
  const radius = stmt.radius ? evalNum(stmt.radius, ctx) : rc.defaultRadius;
  const t = rc.thickness;

  if (length <= 0) {
    addError(ctx, `flange length must be positive`, stmt.span);
    return null;
  }
  if (radius <= 0) {
    addError(ctx, `flange bend radius must be positive`, stmt.span);
    return null;
  }
  if (angleDeg <= 0 || angleDeg > 180) {
    addError(ctx, `flange angle must be between 0 and 180 degrees`, stmt.span);
    return null;
  }

  const bendAllowance =
    ((angleDeg * Math.PI) / 180) * (radius + rc.kFactor * t);
  const wallLength = length - bendAllowance;
  if (wallLength <= 0) {
    addError(
      ctx,
      `flange length ${length} is too short for its bend allowance ${bendAllowance.toFixed(2)}`,
      stmt.span,
    );
    return null;
  }
  return {
    stmt,
    edge: stmt.edgeName,
    length,
    wallLength,
    angleDeg,
    radius,
    bendAllowance,
  };
}

/**
 * Returns whether the input meets the `edge name` condition.
 */
function isEdgeName(name: string): name is EdgeName {
  return (
    name === 'front' || name === 'back' || name === 'left' || name === 'right'
  );
}
