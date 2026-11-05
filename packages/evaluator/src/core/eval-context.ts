/**
 * @author Aidan Boissonneault
 * @file eval-context.ts
 * @purpose Evaluates context for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, SourceSpan } from '@bushscad/ir';
import type { EvalCtx, FaceMetrics } from './eval-types.js';

// Context helpers

/** Create a child context that inherits all maps by shallow copy. Shared refs: tags, counter. */
export function childCtx(ctx: EvalCtx): EvalCtx {
  return {
    ...ctx,
    values: new Map(ctx.values),
    names: new Map(ctx.names),
    components: new Map(ctx.components),
    functions: new Map(ctx.functions),
    sketches: new Map(ctx.sketches),
    sketchComponentMembers: new Set(ctx.sketchComponentMembers),
    sketchPlacements: new Map(ctx.sketchPlacements),
    sketchExplicitPlacements: new Map(ctx.sketchExplicitPlacements),
    surfaceBoundSketches: new Map(ctx.surfaceBoundSketches),
    surfaceBoundSketchUses: ctx.surfaceBoundSketchUses,
    faceMetrics: new Map(ctx.faceMetrics),
    solidMetrics: new Map(ctx.solidMetrics),
    plantAnchors: new Map(ctx.plantAnchors),
    spatialAliases: new Map(ctx.spatialAliases),
    tags: ctx.tags,
    partsSnapshot: ctx.partsSnapshot,
    placedInstanceRoots: new Map(ctx.placedInstanceRoots),
    objectColorOverrides: new Map(ctx.objectColorOverrides),
    objectMaterialOverrides: new Map(ctx.objectMaterialOverrides),
    materialScopes: [...ctx.materialScopes],
    holeRecipes: new Map(ctx.holeRecipes),
    cutThreads: new Map(ctx.cutThreads),
    refBases: new Map(ctx.refBases),
  };
}

/** Record a compile error onto the context's error list. */
export function addError(ctx: EvalCtx, msg: string, span: ASTSourceSpan): void {
  ctx.errors.push({
    message: msg,
    span: {
      file: span.file,
      line: span.line,
      col: span.col,
      endLine: span.endLine,
      endCol: span.endCol,
    },
  });
}

/** Convert an AST source span to an IR source span. */
export function toSpan(span: ASTSourceSpan): SourceSpan {
  return {
    file: span.file,
    line: span.line,
    col: span.col,
    endLine: span.endLine,
    endCol: span.endCol,
  };
}

/** Generate a fresh unique IR name from a base name, using the shared counter. */
export function fresh(ctx: EvalCtx, base: string): string {
  return `${base}_${ctx.counter.n++}`;
}

// Face label normalization

const DIRECT_FACES = new Set([
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
]);

/**
 * Reduce a face label like "box.inner.top.center" to its canonical "box.top" form
 * for lookup in the faceMetrics map. Handles outer/inner and side prefixes.
 */
export function normalizeFaceLabel(label: string): string {
  const parts = label.split('.');
  if (parts.length < 2) return label;

  let face: string | null = null;

  if (DIRECT_FACES.has(parts[1])) {
    face = parts[1];
  } else if (parts[1] === 'side' && DIRECT_FACES.has(parts[2])) {
    face = parts[2];
  } else if (
    (parts[1] === 'outer' || parts[1] === 'inner') &&
    DIRECT_FACES.has(parts[2])
  ) {
    face = parts[2];
  } else if (
    (parts[1] === 'outer' || parts[1] === 'inner') &&
    parts[2] === 'side' &&
    DIRECT_FACES.has(parts[3])
  ) {
    face = parts[3];
  }

  return face ? `${parts[0]}.${face}` : label;
}

/** Look up FaceMetrics for a given IRPlacement, normalizing the face label. */
export function metricsForPlacement(
  ctx: EvalCtx,
  placement: import('@bushscad/ir').IRPlacement,
): FaceMetrics | null {
  return ctx.faceMetrics.get(normalizeFaceLabel(placement.faceRef)) ?? null;
}
