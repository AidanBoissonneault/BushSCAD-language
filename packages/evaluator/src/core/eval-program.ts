/**
 * @author Aidan Boissonneault
 * @file eval-program.ts
 * @purpose Evaluates program for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { DrawingOutputIR, IRPartBoundary, Program } from '@bushscad/ir';

import { emptyMaterialContext } from '@bushscad/ir';

import type { Deferred, EvalCtx } from './eval-types.js';

import type { EvaluateOptions, EvaluateResult } from './eval-types.js';

import { unitToMm } from '../expressions/eval-expressions.js';

import { evalTopStmt } from './eval-top-stmt.js';
import { captureScalarCacheContext } from './eval-context.js';

import {
  collectEnvNamesFromTopLevel,
  registerTopLevelComponents,
} from './eval-program-analysis.js';
import { buildInteractionProvenance } from '../metadata/eval-interaction-provenance.js';

// Top-level statement evaluation

// Entry point

/**
 * Evaluates a resolved AST into a flat IR program.
 * All loops, conditionals, and variables are fully unrolled — the result
 * contains only concrete IR ops.
 */
export function evaluate(
  ast: Program,
  options: EvaluateOptions = {},
): EvaluateResult {
  const baseUnitMm = unitToMm(
    (ast.baseUnit ?? 'mm') as 'mm' | 'cm' | 'm' | 'in' | 'ft',
  );

  const ctx: EvalCtx = {
    bodyNameFacts: new WeakMap(),
    values: new Map(),
    names: new Map(),
    components: new Map(),
    functions: new Map(),
    sketches: new Map(),
    sketchComponentMembers: new Set(),
    sketchPlacements: new Map(),
    sketchExplicitPlacements: new Map(),
    surfaceBoundSketches: new Map(),
    surfaceBoundSketchUses: new Map(),
    faceMetrics: new Map(),
    solidMetrics: new Map(),
    plantAnchors: new Map(),
    spatialAliases: new Map(),
    tags: new Map(),
    placedInstanceRoots: new Map(),
    thisContext: null,
    autoContext: null,
    autoAxis: null,
    autoGroups: null,
    autoValues: null,
    activePlacement: null,
    activeColor: null,
    activeMaterial: null,
    objectColorOverrides: new Map(),
    objectMaterialOverrides: new Map(),
    activePartName: null,
    partsSnapshot: new Map(),
    materialScopes: [],
    materialContext: options.materials ?? emptyMaterialContext(),
    baseUnitMm,
    envOverrides: new Map(Object.entries(options.env ?? {})),
    ops: [],
    interactionInvocations: [],
    errors: [],
    counter: { n: 0 },
    holeRecipes: new Map(),
    cutThreads: new Map(),
    refBases: new Map(),
    activeProcessProfile: null,
    fitDecls: new Map(),
    emitHardwareVisuals: options.showHardwareVisuals ?? true,
    cacheContextSpans: new Set(
      (options.cacheContextSpans ?? []).map(({ file, line }) =>
        cacheContextKey(file, line),
      ),
    ),
  };

  const envNames = collectEnvNamesFromTopLevel(ast.statements);
  for (const name of ctx.envOverrides.keys()) {
    if (!envNames.has(name)) {
      ctx.errors.push({
        message: `Unknown env override '${name}'`,
        span: { file: ast.span.file, line: ast.span.line, col: ast.span.col },
      });
    }
  }

  for (const stmt of ast.statements) {
    registerTopLevelComponents(stmt, ctx);
  }

  const drawingOutputs: DrawingOutputIR[] = [];
  const topLevelDeferred: Deferred = [];
  for (const stmt of ast.statements) {
    evalTopStmt(stmt, ctx, drawingOutputs, topLevelDeferred);
  }
  for (const op of topLevelDeferred) ctx.ops.push(op);
  attachTopLevelCacheContext(ctx);

  const parts = ctx.ops
    .filter((op): op is IRPartBoundary => op.kind === 'part')
    .map((op) => op.name);

  return {
    program: {
      ops: ctx.ops,
      parts,
      baseUnitMm,
      workplane: ast.workplane ?? 'XY',
      interaction: buildInteractionProvenance(
        ast.span.file,
        ctx.ops,
        ast,
        ctx.interactionInvocations,
      ),
    },
    drawings: { drawings: drawingOutputs },
    errors: ctx.errors,
  };
}

/** Creates the stable source-location key shared by loop capture and breakpoints. */
function cacheContextKey(file: string, line: number): string {
  return `${file}\0${line}`;
}

/** Adds visible scalar top-level values to conditional cache breakpoint operations. */
function attachTopLevelCacheContext(ctx: EvalCtx): void {
  if (ctx.cacheContextSpans.size === 0) return;
  for (let index = 0; index < ctx.ops.length; index++) {
    const operation = ctx.ops[index];
    if (
      !operation ||
      operation.cacheContext ||
      !ctx.cacheContextSpans.has(cacheContextKey(operation.span.file, operation.span.line))
    )
      continue;
    const cacheContext = captureScalarCacheContext(ctx.values);
    if (Object.keys(cacheContext).length > 0)
      ctx.ops[index] = { ...operation, cacheContext };
  }
}
