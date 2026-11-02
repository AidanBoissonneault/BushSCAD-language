/**
 * @author Aidan Boissonneault
 * @file eval-material-inline.ts
 * @purpose Evaluates material inline for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, MaterialAppearance } from '@bushscad/ir';
import { findMaterialByName } from '@bushscad/ir';
import { addError } from '../core/eval-context.js';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';

/**
 * Resolves an inline material metadata value against the active material catalog.
 * Metadata evaluation stores arbitrary values first, so material-specific
 * validation belongs at the boundary where geometry operations consume it.
 */
export function resolveInlineMaterial(
  value: EvalValue,
  ctx: EvalCtx,
  span: ASTSourceSpan,
): MaterialAppearance | null {
  if (typeof value !== 'string') {
    addError(ctx, `material metadata expects a material name string`, span);
    return null;
  }
  const material = findMaterialByName(ctx.materialContext.catalog, value);
  if (!material) {
    addError(ctx, `Unknown material '${value}'`, span);
    return null;
  }
  return material;
}
