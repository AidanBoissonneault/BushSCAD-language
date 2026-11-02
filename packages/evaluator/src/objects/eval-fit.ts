/**
 * @author Aidan Boissonneault
 * @file eval-fit.ts
 * @purpose Evaluates fit for the objects in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FitDecl, IRFit } from '@bushscad/ir';
import {
  lookupToleranceOffset,
  isProcessProfileLibrary,
  DEFAULT_PROFILE,
} from '@bushscad/std-tolerances';
import type { FitKind, ToleranceLevel } from '@bushscad/std-tolerances';
import type { EvalCtx } from '../core/eval-types.js';
import { toSpan, addError } from '../core/eval-context.js';

/**
 * Evaluates fit declaration with the current evaluation context.
 */
export function evalFitDecl(stmt: FitDecl, ctx: EvalCtx): void {
  const profile = ctx.activeProcessProfile ?? DEFAULT_PROFILE;
  const fitKind = stmt.fitKind as FitKind;
  const level = stmt.toleranceLevel as ToleranceLevel;

  let resolvedOffsetMm = lookupToleranceOffset(profile, fitKind, level);

  // Per-fit env override via `env std_<fitName>_clearance fallback <value>`.
  // Check ctx.values (in-file env declarations evaluated before this fit).
  const overrideKey = `std_${stmt.fitName}_clearance`;
  const override = ctx.values.get(overrideKey);
  if (typeof override === 'number') {
    resolvedOffsetMm = override;
  }

  const irFit: IRFit = {
    kind: 'fit',
    fitKind: stmt.fitKind,
    fitName: stmt.fitName,
    relation: stmt.relation,
    targetName: stmt.targetName,
    toleranceLevel: stmt.toleranceLevel,
    resolvedOffsetMm,
    processProfile: profile,
    span: toSpan(stmt.span),
  };

  ctx.ops.push(irFit);
  ctx.fitDecls.set(stmt.fitName, irFit);
}

/**
 * Evaluates use library with the current evaluation context.
 */
export function evalUseLibrary(library: string, ctx: EvalCtx): void {
  if (isProcessProfileLibrary(library)) {
    ctx.activeProcessProfile = library;
  }
  // std.hardware.* and unknown libs: no-op (hardware tables always available)
}

/**
 * Expand fit_ok(fitName, targetName) into the resolved min offset for assertion building.
 * Returns { resolvedOffsetMm, isInterference } so the caller can emit the right IRAssert direction.
 * Returns null and emits an error if the fit declaration is not found.
 */
export function resolveFitOk(
  fitName: string,
  _targetName: string,
  ctx: EvalCtx,
  span: import('@bushscad/ir').ASTSourceSpan,
): { resolvedOffsetMm: number; isInterference: boolean } | null {
  const fit = ctx.fitDecls.get(fitName);
  if (!fit) {
    addError(ctx, `fit_ok: no fit declaration found for '${fitName}'`, span);
    return null;
  }
  const isInterference =
    fit.fitKind === 'press' || fit.fitKind === 'interference';
  return { resolvedOffsetMm: fit.resolvedOffsetMm, isInterference };
}
