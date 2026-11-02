/**
 * @author Aidan Boissonneault
 * @file eval-hardware-visuals.ts
 * @purpose Evaluates hardware visuals for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRHardwareVisual, IRPlacement, SourceSpan } from '@bushscad/ir';
import { normalizeSize } from '@bushscad/std-hardware';
import type { EvalCtx } from '../core/eval-types.js';

const BOLT_HEAD_DIMS: Record<string, { af: number; height: number }> = {
  M2: { af: 4.0, height: 2.0 },
  M2_5: { af: 5.0, height: 2.5 },
  M3: { af: 5.5, height: 3.0 },
  M4: { af: 7.0, height: 4.0 },
  M5: { af: 8.5, height: 5.0 },
  M6: { af: 10.0, height: 6.0 },
  M8: { af: 13.0, height: 8.0 },
};

/** Emits an optional visual bolt body for previewing hardware holes. */
export function emitBoltVisual(
  ctx: EvalCtx,
  irName: string,
  size: string,
  clearanceDiameter: number,
  depthMm: number | null,
  from: IRPlacement,
  span: SourceSpan,
): void {
  if (!ctx.emitHardwareVisuals) return;
  const head = BOLT_HEAD_DIMS[normalizeSize(size)];
  ctx.ops.push({
    kind: 'hardware_visual',
    hardwareKind: 'bolt',
    objName: `${irName}__hw_bolt`,
    diameterMm: clearanceDiameter,
    heightMm: depthMm ?? 20,
    headDiameterMm: head?.af,
    headHeightMm: head?.height,
    placement: from,
    span,
  } satisfies IRHardwareVisual);
}

/** Emits an optional heatset insert body for previewing hardware holes. */
export function emitInsertVisual(
  ctx: EvalCtx,
  irName: string,
  outerDiameter: number,
  depthMm: number,
  from: IRPlacement,
  span: SourceSpan,
): void {
  if (!ctx.emitHardwareVisuals) return;
  ctx.ops.push({
    kind: 'hardware_visual',
    hardwareKind: 'insert',
    objName: `${irName}__hw_insert`,
    diameterMm: outerDiameter,
    heightMm: depthMm,
    placement: from,
    span,
  } satisfies IRHardwareVisual);
}
