/**
 * @author Aidan Boissonneault
 * @file eval-ref-decl.ts
 * @purpose Evaluates ref declaration for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRRef, ComponentBody } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { toSpan } from '../core/eval-context.js';
import {
  evalNum,
  evalPlacement,
  serializeAnchorTarget,
} from '../expressions/eval-expressions.js';

// Ref-extends declaration evaluation

/**
 * Evaluates ref declaration with the current evaluation context.
 */
export function evalRefDecl(
  name: string,
  extendsBase: string,
  body: ComponentBody,
  span: { file: string; line: number; col: number },
  ctx: EvalCtx,
): void {
  const baseName = ctx.names.get(extendsBase) ?? extendsBase;
  ctx.names.set(name, name);
  ctx.ops.push({ kind: 'ref', name, baseName, span } satisfies IRRef);
  for (const stmt of body.statements) {
    const s = toSpan(stmt.span);
    if (stmt.kind === 'heal') {
      ctx.ops.push({
        kind: 'heal',
        target: name,
        tolerance: evalNum(stmt.tolerance, ctx),
        span: s,
      });
    } else if (stmt.kind === 'defeature') {
      ctx.ops.push({
        kind: 'defeature',
        target: name,
        featureType: stmt.featureType,
        threshold: evalNum(stmt.threshold, ctx),
        span: s,
      });
    } else if (stmt.kind === 'anchor') {
      const label =
        stmt.point.kind === 'faceRef'
          ? serializeAnchorTarget(stmt.point, ctx, name)
          : evalPlacement(stmt.point, ctx).faceRef;
      if (label) ctx.tags.set(stmt.name, { kind: 'faceRefValue', label });
    }
  }
  ctx.refBases.set(name, name);
  ctx.components.set(name, body);
}
