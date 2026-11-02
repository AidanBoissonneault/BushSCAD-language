/**
 * @author Aidan Boissonneault
 * @file eval-solid-cut.ts
 * @purpose Evaluates solid cut for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  IRExtrude,
  IRLoft,
  IRRevolve,
  IRSolidCut,
  IRSolidCutTool,
  IRSweep,
  IRSurfaceThicken,
  SolidCutOp,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { toSpan } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import {
  evalRepeatablePlacements,
  evalSingularPlacement,
} from '../references/eval-repeatable-refs.js';
import {
  evalPathInputName,
  evalSketchInputName,
  evalSurfaceInputName,
} from './eval-inline-operands.js';
import {
  requireClosedSketch,
  requireOpenGuideSketch,
} from './eval-primitives.js';
import { paramSpansFrom } from '../statements/eval-param-spans.js';
import type { Expr } from '@bushscad/ir';
import { evalSketchBodySelection } from '../sketch/eval-sketch-body-selection.js';

/**
 * Derives `InlineSolidOperation` from `Extract< SolidCutOp['tool'], { kind: 'operation' }
 * >['operation']` to preserve its type relationship in the geometry layer.
 */
type InlineSolidOperation = Extract<
  SolidCutOp['tool'],
  { kind: 'operation' }
>['operation'];

/**
 * Derives `InlineSolidIrOperation` from `Extract< IRSolidCutTool, { kind: 'operation' }
 * >['operation']` to preserve its type relationship in the geometry layer.
 */
type InlineSolidIrOperation = Extract<
  IRSolidCutTool,
  { kind: 'operation' }
>['operation'];

/**
 * Lowers `cut(<solid-tool>, from ...)` to a solid-tool cut IR operation.
 * The regular cut IR remains sketch-based. Solid-tool cuts need a copied body
 * or a temporary inline solid shape that the OCCT bridge can subtract without
 * exposing inline tools as standalone output geometry.
 */
export function evalSolidCutOp(
  astName: string,
  op: SolidCutOp,
  ctx: EvalCtx,
): string {
  const irName = ctx.names.get(astName) ?? astName;
  const from = evalRepeatablePlacements(op.from, ctx)[0];
  ctx.ops.push({
    kind: 'solid_cut',
    objName: irName,
    tool: evalSolidCutTool(`${irName}__tool`, op, ctx),
    from,
    span: toSpan(op.span),
  } satisfies IRSolidCut);
  copyTargetMetrics(ctx, irName, from.faceRef);
  return irName;
}

/**
 * Gives solid-cut aliases the same symbolic face dimensions as their target.
 * The OCCT bridge mutates the target body and registers the cut result under
 * the new operation name, so evaluator-only consumers like `within` need the
 * alias to expose compatible face metrics before geometry exists.
 */
function copyTargetMetrics(
  ctx: EvalCtx,
  resultName: string,
  sourceFaceRef: string,
): void {
  const sourceName = sourceFaceRef.split('.')[0];
  if (!sourceName) return;
  const solid = ctx.solidMetrics.get(sourceName);
  if (solid) ctx.solidMetrics.set(resultName, { ...solid });
  for (const face of ['top', 'bottom', 'front', 'back', 'left', 'right']) {
    const metric = ctx.faceMetrics.get(`${sourceName}.${face}`);
    if (!metric) continue;
    ctx.faceMetrics.set(`${resultName}.${face}`, {
      ...metric,
      center: { faceRef: `${resultName}.${face}.center` },
    });
  }
}

/**
 * Handles pos offsets in the geometry flow.
 */
function posOffsets(from: RepeatableSpatialRef | null | undefined): {
  x?: Expr;
  y?: Expr;
} {
  if (from && from.kind === 'pos') return { x: from.x, y: from.y };
  return {};
}

/**
 * Evaluates solid cut tool with the current evaluation context.
 */
function evalSolidCutTool(
  toolName: string,
  op: SolidCutOp,
  ctx: EvalCtx,
): IRSolidCutTool {
  if (op.tool.kind === 'object') {
    const object = op.tool.object;
    const objName =
      object.kind === 'namedObject'
        ? (ctx.names.get(object.name) ?? object.name)
        : toolName;
    return { kind: 'object', objName };
  }
  return {
    kind: 'operation',
    operation: evalInlineSolidOperation(toolName, op.tool.operation, ctx),
  };
}

/**
 * Evaluates inline solid operation with the current evaluation context.
 */
function evalInlineSolidOperation(
  toolName: string,
  op: InlineSolidOperation,
  ctx: EvalCtx,
): InlineSolidIrOperation {
  if (op.kind === 'extrude') {
    return evalInlineExtrudeTool(toolName, op, ctx);
  }
  if (op.kind === 'revolve') {
    return evalInlineRevolveTool(toolName, op, ctx);
  }
  if (op.kind === 'loft') {
    return evalInlineLoftTool(toolName, op, ctx);
  }
  if (op.kind === 'sweep') {
    return evalInlineSweepTool(toolName, op, ctx);
  }
  return evalInlineThickenTool(toolName, op, ctx);
}

/**
 * Evaluates inline extrude tool with the current evaluation context.
 */
function evalInlineExtrudeTool(
  toolName: string,
  op: Extract<InlineSolidOperation, { kind: 'extrude' }>,
  ctx: EvalCtx,
): IRExtrude {
  const sketchName = evalSketchInputName(op.sketch, ctx, toolName);
  const closedBodyNames = evalSketchBodySelection(
    op.sketch,
    sketchName,
    op.span,
    ctx,
  );
  requireClosedSketch(ctx, sketchName, 'solid cut tool extrude', op.span);
  return {
    kind: 'extrude',
    objName: toolName,
    sketchName,
    closedBodyNames,
    depth: evalNum(op.depth, ctx),
    from: op.from ? evalRepeatablePlacements(op.from, ctx)[0] : null,
    symmetric: op.symmetric,
    wrap: false,
    paramSpans: paramSpansFrom({ depth: op.depth, ...posOffsets(op.from) }),
    span: toSpan(op.span),
  };
}

/**
 * Evaluates inline revolve tool with the current evaluation context.
 */
function evalInlineRevolveTool(
  toolName: string,
  op: Extract<InlineSolidOperation, { kind: 'revolve' }>,
  ctx: EvalCtx,
): IRRevolve {
  const sketchName = evalSketchInputName(op.sketch, ctx, toolName);
  requireClosedSketch(ctx, sketchName, 'solid cut tool revolve', op.span);
  return {
    kind: 'revolve',
    objName: toolName,
    sketchName,
    angleDeg: evalNum(op.angle, ctx),
    around:
      typeof op.around === 'string'
        ? op.around
        : evalSingularPlacement(op.around, ctx, op.around.span, 'revolve-axis'),
    radius: op.radius !== undefined ? evalNum(op.radius, ctx) : undefined,
    span: toSpan(op.span),
  };
}

/**
 * Evaluates inline loft tool with the current evaluation context.
 */
function evalInlineLoftTool(
  toolName: string,
  op: Extract<InlineSolidOperation, { kind: 'loft' }>,
  ctx: EvalCtx,
): IRLoft {
  const sketchNames = op.sketches.map((sketch, index) =>
    evalSketchInputName(sketch, ctx, `${toolName}_${index}`),
  );
  for (const sketchName of sketchNames) {
    requireClosedSketch(ctx, sketchName, 'solid cut tool loft', op.span);
  }
  const guide = op.guide
    ? evalSketchInputName(op.guide, ctx, `${toolName}_guide`)
    : null;
  if (guide) requireOpenGuideSketch(ctx, guide, op.span);
  return {
    kind: 'loft',
    objName: toolName,
    sketchNames,
    height: evalNum(op.height, ctx),
    guide,
    guideWorkplane: op.guideWorkplane,
    span: toSpan(op.span),
  };
}

/**
 * Evaluates inline sweep tool with the current evaluation context.
 */
function evalInlineSweepTool(
  toolName: string,
  op: Extract<InlineSolidOperation, { kind: 'sweep' }>,
  ctx: EvalCtx,
): IRSweep {
  const sketchName = evalSketchInputName(op.sketch, ctx, toolName);
  requireClosedSketch(ctx, sketchName, 'solid cut tool sweep', op.span);
  return {
    kind: 'sweep',
    objName: toolName,
    sketchName,
    pathName: evalPathInputName(op.path, ctx, toolName),
    orientation: op.orientation,
    span: toSpan(op.span),
  };
}

/**
 * Evaluates inline thicken tool with the current evaluation context.
 */
function evalInlineThickenTool(
  toolName: string,
  op: Extract<InlineSolidOperation, { kind: 'thicken' }>,
  ctx: EvalCtx,
): IRSurfaceThicken {
  return {
    kind: 'surfaceThicken',
    objName: toolName,
    surfaceName: evalSurfaceInputName(op.surface, ctx, toolName),
    thickness: evalNum(op.thickness, ctx) * ctx.baseUnitMm,
    span: toSpan(op.span),
  };
}
