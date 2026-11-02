/**
 * @author Aidan Boissonneault
 * @file eval-material-resolution.ts
 * @purpose Evaluates material resolution for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import type { MaterialAppearance } from '@bushscad/ir';
import { colorMaterial, findAssignedMaterial } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';

/** Resolves the effective material for an emitted geometry object. */
export function materialForObject(
  astName: string,
  ctx: EvalCtx,
): MaterialAppearance | null {
  const objectMaterial = ctx.objectMaterialOverrides.get(astName);
  const objectColor = ctx.objectColorOverrides.get(astName);
  const candidates = [
    astName,
    ...[...ctx.materialScopes].reverse(),
    ...(ctx.activePartName ? [ctx.activePartName] : []),
  ];
  const material =
    objectMaterial ??
    ctx.activeMaterial ??
    findAssignedMaterial(ctx.materialContext, candidates) ??
    null;
  const color = objectColor ?? ctx.activeColor;
  if (!color) return material;
  const normalizedColor = colorMaterial(color).color;
  return material
    ? { ...material, color: normalizedColor }
    : colorMaterial(normalizedColor);
}
