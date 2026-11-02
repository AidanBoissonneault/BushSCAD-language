/**
 * @author Aidan Boissonneault
 * @file eval-hardware-hole.ts
 * @purpose Evaluates hardware hole for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  HoleOp,
  HeatsetInsertOp,
  IRCut,
  IRPlacement,
  IRPrimitive,
  IRSketch,
  SourceSpan,
} from '@bushscad/ir';
import { lookupMetricSpec } from '@bushscad/std-hardware';
import { addError, toSpan } from '../core/eval-context.js';
import type { EvalCtx, HoleStep } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { evalRepeatablePlacements } from '../references/eval-repeatable-refs.js';
import { evalThroughTargetName } from './eval-through-target.js';
import { emitBoltVisual, emitInsertVisual } from './eval-hardware-visuals.js';

/** Offsets a placement while preserving all non-offset placement metadata. */
export function offsetIRPlacement(
  p: IRPlacement,
  dx: number,
  dy: number,
): IRPlacement {
  return {
    ...p,
    offsetX: (p.offsetX ?? 0) + dx,
    offsetY: (p.offsetY ?? 0) + dy,
  };
}

/**
 * Emits the generated circular sketch and cut pair used by hardware holes.
 * Hole pattern expansion replays recorded hole steps, so the primitive sketch
 * and the cut operation must be emitted consistently in both original and
 * repeated placements.
 */
export function emitHoleSketchAndCut(
  ctx: EvalCtx,
  sketchIrName: string,
  objIrName: string,
  diameterMm: number,
  through: boolean,
  throughTarget: string | null,
  depthMm: number | null,
  placement: IRPlacement,
  span: SourceSpan,
): void {
  const prim: IRPrimitive = { kind: 'circle', diameter: diameterMm };
  ctx.sketches.set(sketchIrName, prim);
  ctx.sketchPlacements.set(sketchIrName, placement);
  ctx.sketchExplicitPlacements.set(sketchIrName, true);
  ctx.ops.push({
    kind: 'sketch',
    name: sketchIrName,
    primitive: prim,
    placement,
    span,
  } satisfies IRSketch);
  ctx.ops.push({
    kind: 'cut',
    objName: objIrName,
    sketchName: sketchIrName,
    through,
    throughTarget,
    depth: through ? null : depthMm,
    from: placement,
    wrap: false,
    span,
  } satisfies IRCut);
  ctx.cutThreads.set(objIrName, { placement, depthMm });
}

/** Lowers hardware hole syntax into generated sketch/cut steps and optional visuals. */
export function evalHoleOp(astName: string, op: HoleOp, ctx: EvalCtx): string {
  const irName = ctx.names.get(astName) ?? astName;
  const spec = lookupMetricSpec(op.spec.size, op.spec.specKind);
  if (!spec) {
    addError(
      ctx,
      `Unknown hardware size '${op.spec.size}' â€” use M2, M2.5, M3, M4, M5, M6, or M8`,
      op.spec.span,
    );
    return irName;
  }

  const from = resolveHardwarePlacement(
    op,
    ctx,
    `hole(...) without a spatial argument requires a placement context; add a final @target argument or call inside place(...)`,
  );
  if (!from) {
    return irName;
  }

  const span = toSpan(op.span);
  const through = op.through !== null;
  const throughTarget = evalThroughTargetName(op.through, from, ctx);
  const depthMm =
    op.depth !== null ? evalNum(op.depth, ctx) * ctx.baseUnitMm : null;
  const steps = holeSteps(
    irName,
    spec,
    through,
    throughTarget,
    depthMm,
    from,
    span,
    ctx,
  );

  ctx.holeRecipes.set(irName, steps);
  emitHoleVisual(ctx, irName, op.spec.size, spec, depthMm, from, span);
  return irName;
}

/**
 * Resolves hardware placement using the geometry rules.
 */
export function resolveHardwarePlacement(
  op: Pick<HoleOp | HeatsetInsertOp, 'from' | 'span'>,
  ctx: EvalCtx,
  missingMessage: string,
): IRPlacement | null {
  const from = op.from
    ? evalRepeatablePlacements(op.from, ctx)[0]
    : ctx.activePlacement;
  if (!from) addError(ctx, missingMessage, op.span);
  return from ?? null;
}

/**
 * Handles hole steps in the geometry flow.
 */
function holeSteps(
  irName: string,
  spec: ReturnType<typeof lookupMetricSpec> & {},
  through: boolean,
  throughTarget: string | null,
  depthMm: number | null,
  from: IRPlacement,
  span: SourceSpan,
  ctx: EvalCtx,
): HoleStep[] {
  if (spec.kind === 'counterbore') {
    return [
      emitHoleStep(
        `${irName}__bore_sk`,
        `${irName}__bore`,
        spec.boreDiameter,
        false,
        null,
        spec.boreDepth,
        from,
        span,
        ctx,
      ),
      emitHoleStep(
        `${irName}__sk`,
        irName,
        spec.clearanceDiameter,
        through,
        throughTarget,
        depthMm,
        from,
        span,
        ctx,
      ),
    ];
  }
  if (spec.kind === 'countersink') {
    return [
      emitHoleStep(
        `${irName}__sk`,
        irName,
        spec.clearanceDiameter,
        through,
        throughTarget,
        depthMm,
        from,
        span,
        ctx,
      ),
    ];
  }
  if (spec.kind === 'heatset_insert') {
    const depth = depthMm ?? spec.defaultDepth;
    return [
      emitHoleStep(
        `${irName}__sk`,
        irName,
        spec.outerDiameter,
        false,
        null,
        depth,
        from,
        span,
        ctx,
      ),
    ];
  }
  return [
    emitHoleStep(
      `${irName}__sk`,
      irName,
      spec.diameter,
      through,
      throughTarget,
      depthMm,
      from,
      span,
      ctx,
    ),
  ];
}

/**
 * Emits hole step into the current output.
 */
function emitHoleStep(
  sketchIrName: string,
  objIrName: string,
  diameterMm: number,
  through: boolean,
  throughTarget: string | null,
  depthMm: number | null,
  placement: IRPlacement,
  span: SourceSpan,
  ctx: EvalCtx,
): HoleStep {
  emitHoleSketchAndCut(
    ctx,
    sketchIrName,
    objIrName,
    diameterMm,
    through,
    throughTarget,
    depthMm,
    placement,
    span,
  );
  return holeStep(
    sketchIrName,
    objIrName,
    diameterMm,
    through,
    throughTarget,
    depthMm,
    placement,
    span,
  );
}

/**
 * Handles hole step in the geometry flow.
 */
export function holeStep(
  sketchIrName: string,
  objIrName: string,
  diameterMm: number,
  through: boolean,
  throughTarget: string | null,
  depthMm: number | null,
  placement: IRPlacement,
  span: SourceSpan,
): HoleStep {
  return {
    sketchIrName,
    objIrName,
    diameterMm,
    through,
    throughTarget,
    depthMm,
    placement,
    span,
  };
}

/**
 * Emits hole visual into the current output.
 */
function emitHoleVisual(
  ctx: EvalCtx,
  irName: string,
  size: string,
  spec: ReturnType<typeof lookupMetricSpec> & {},
  depthMm: number | null,
  from: IRPlacement,
  span: SourceSpan,
): void {
  if (
    spec.kind === 'clearance' ||
    spec.kind === 'counterbore' ||
    spec.kind === 'countersink'
  ) {
    emitBoltVisual(ctx, irName, size, boltDiameter(spec), depthMm, from, span);
  } else if (spec.kind === 'heatset_insert') {
    emitInsertVisual(
      ctx,
      irName,
      spec.outerDiameter,
      depthMm ?? spec.defaultDepth,
      from,
      span,
    );
  }
}

/**
 * Handles bolt diameter in the geometry flow.
 */
function boltDiameter(spec: ReturnType<typeof lookupMetricSpec> & {}): number {
  if ('clearanceDiameter' in spec) return spec.clearanceDiameter;
  if ('diameter' in spec) return spec.diameter;
  return spec.outerDiameter;
}
