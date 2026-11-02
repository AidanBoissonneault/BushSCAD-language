/**
 * @author Aidan Boissonneault
 * @file eval-inline-operands.ts
 * @purpose Evaluates inline operands for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRPath,
  IRPlacement,
  IRSketch,
  IRSurfaceFill,
  IRSurfaceOffset,
  PathInput,
  SketchInput,
  SurfaceInput,
  SurfaceOperation,
  PathPrimitive,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError, fresh, toSpan } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { evalPrimitive } from './eval-primitives.js';
import { evalSingularSelection } from '../references/eval-resolved-selection.js';

/**
 * Resolves a sketch input to an IR sketch name, emitting a hidden sketch for
 * inline sketch expressions.
 */
export function evalSketchInputName(
  input: SketchInput,
  ctx: EvalCtx,
  label: string,
  placement: IRPlacement | null = ctx.activePlacement,
  explicitPlacement = false,
): string {
  if (input.kind === 'namedSketch')
    return resolveNamedSketchInput(input.name, ctx);
  if (input.kind === 'namedSketchBody' || input.kind === 'sketchBodyList') {
    return resolveNamedSketchInput(input.sketchName, ctx);
  }
  if (input.kind === 'sketchList') {
    addError(
      ctx,
      'Sketch input arrays must be expanded before evaluation',
      input.span,
    );
    return input.items[0]
      ? evalSketchInputName(
          input.items[0],
          ctx,
          label,
          placement,
          explicitPlacement,
        )
      : fresh(ctx, `__inline_${label}_sketch`);
  }

  const irName = fresh(ctx, `__inline_${label}_sketch`);
  const prim = evalPrimitive(input.primitive, ctx);
  if (!prim) return irName;
  ctx.sketches.set(irName, prim);
  ctx.sketchPlacements.set(irName, placement);
  ctx.sketchExplicitPlacements.set(irName, explicitPlacement);
  ctx.ops.push({
    kind: 'sketch',
    name: irName,
    primitive: prim,
    placement,
    span: toSpan(input.span),
  } satisfies IRSketch);
  return irName;
}

/** Returns requested closed-body names from a sketch operand, if any. */
export function closedBodyNamesForSketchInput(
  input: SketchInput,
): string[] | undefined {
  if (input.kind === 'namedSketchBody') return [input.bodyName];
  if (input.kind === 'sketchBodyList') return input.bodyNames;
  return undefined;
}

/**
 * Resolves a source sketch name to the IR sketch name currently in scope.
 * `ctx.names` is shared by several declaration kinds for loop/place renaming.
 * A later object may reuse the same source identifier as a sketch, so a sketch
 * operand must only accept mapped names that are registered sketches.
 */
function resolveNamedSketchInput(name: string, ctx: EvalCtx): string {
  const mapped = ctx.names.get(name);
  if (mapped && ctx.sketches.has(mapped)) return mapped;
  if (ctx.sketches.has(name)) return name;
  return mapped ?? name;
}

/** Resolves a path input to an IR path name, emitting a hidden inline path. */
export function evalPathInputName(
  input: PathInput,
  ctx: EvalCtx,
  label: string,
): string {
  if (input.kind === 'namedPath')
    return ctx.names.get(input.name) ?? input.name;

  const irName = fresh(ctx, `__inline_${label}_path`);
  ctx.ops.push({
    kind: 'path',
    name: irName,
    primitive: evalPathPrimitive(input.primitive, ctx),
    span: toSpan(input.span),
  } satisfies IRPath);
  return irName;
}

/** Evaluates a source path primitive into numeric IR path coordinates. */
export function evalPathPrimitive(
  primitive: PathPrimitive,
  ctx: EvalCtx,
): IRPath['primitive'] {
  return {
    kind: primitive.kind,
    points: primitive.points.map((pt) => ({
      x: evalNum(pt.x, ctx) * ctx.baseUnitMm,
      y: evalNum(pt.y, ctx) * ctx.baseUnitMm,
      z: evalNum(pt.z, ctx) * ctx.baseUnitMm,
    })),
  };
}

/** Resolves a surface input to an IR surface name, emitting hidden surfaces. */
export function evalSurfaceInputName(
  input: SurfaceInput,
  ctx: EvalCtx,
  label: string,
): string {
  if (input.kind === 'namedSurface')
    return ctx.names.get(input.name) ?? input.name;
  return emitInlineSurfaceOperation(input.operation, ctx, label, input.span);
}

/**
 * Emits inline surface operation into the current output.
 */
function emitInlineSurfaceOperation(
  operation: SurfaceOperation,
  ctx: EvalCtx,
  label: string,
  span: SurfaceInput['span'],
): string {
  const irName = fresh(ctx, `__inline_${label}_surface`);
  if (operation.kind === 'fill') {
    const selection = evalSingularSelection(operation.boundary, ctx, 'fill');
    ctx.ops.push({
      kind: 'surface',
      name: irName,
      boundary: selection.targets[0]?.label ?? '',
      selection,
      span: toSpan(span),
    } satisfies IRSurfaceFill);
    return irName;
  }

  ctx.ops.push({
    kind: 'surfaceOffset',
    name: irName,
    source: evalSurfaceInputName(operation.surface, ctx, label),
    distance: evalNum(operation.distance, ctx) * ctx.baseUnitMm,
    span: toSpan(span),
  } satisfies IRSurfaceOffset);
  return irName;
}
