/**
 * @author Aidan Boissonneault
 * @file eval-anchor-aliases.ts
 * @purpose Evaluates anchor aliases for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FaceRef, PosRef } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalPlacement } from '../expressions/eval-expressions.js';
import { serializeAnchorTarget } from './eval-face-expressions.js';

/**
 * Registers an `@` anchor as both a placement alias and, for face anchors, a
 * face-reference alias.
 * Placement lookups and face-reference serialization use different internal
 * maps. Anchor declarations are the public syntax for both forms.
 */
export function declareAnchorAlias(
  name: string,
  point: FaceRef | PosRef,
  ctx: EvalCtx,
): void {
  ctx.spatialAliases.set(name, evalPlacement(point, ctx));
  if (point.kind === 'faceRef') {
    ctx.tags.set(name, {
      kind: 'faceRefValue',
      label: serializeAnchorTarget(point, ctx, null),
    });
  }
}
