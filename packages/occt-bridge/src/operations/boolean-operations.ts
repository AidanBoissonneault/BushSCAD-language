/**
 * @author Aidan Boissonneault
 * @file boolean-operations.ts
 * @purpose Provides boolean operations behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { isNullShape, occtError } from '../core/occt-errors.js';

export const BOOLEAN_TOLERANCE = 1e-7;

/**
 * Options for stable boolean, including configure, simplify, and use glue.
 */
type StableBooleanOptions = {
  configure?: boolean;
  simplify?: boolean;
  useGlue?: boolean;
};

/**
 * Applies a robust OCCT boolean fuse and heals only invalid results.
 * Edge-coincident additive solids can leave OCCT with fragile same-domain
 * topology. Enabling conservative boolean options and simplifying the result
 * keeps the resulting solid valid before later fillets and meshing.
 */
export function applyStableBoolFuse(
  oc: OC,
  a: OC,
  b: OC,
  span: SourceSpan,
  failureMessage = 'Boolean fuse failed',
  options: StableBooleanOptions = {},
): OC {
  const fuser = new oc.BRepAlgoAPI_Fuse_3(a, b);
  try {
    if (options.configure !== false)
      configureBooleanBuilder(oc, fuser, options);
    fuser.Build();
    if (!fuser.IsDone()) throw occtError(failureMessage, span);
    if (options.simplify !== false) {
      fuser.SimplifyResult?.(true, true, BOOLEAN_TOLERANCE);
    }
    return validOrHealedShape(oc, fuser.Shape(), span, failureMessage);
  } finally {
    fuser.delete?.();
  }
}

/**
 * Applies a boolean cut using the same validity guard as additive fuses.
 * Cut operations feed the same downstream selector and meshing pipeline, so
 * invalid boolean results should be caught or repaired consistently.
 */
export function applyStableBoolCut(
  oc: OC,
  target: OC,
  tool: OC,
  span: SourceSpan,
): OC {
  const cutter = new oc.BRepAlgoAPI_Cut_3(target, tool);
  try {
    configureBooleanBuilder(oc, cutter, { useGlue: false });
    cutter.Build();
    if (!cutter.IsDone()) throw occtError('Boolean cut failed', span);
    cutter.SimplifyResult?.(true, true, BOOLEAN_TOLERANCE);
    return validOrHealedShape(oc, cutter.Shape(), span, 'Boolean cut failed');
  } finally {
    cutter.delete?.();
  }
}

/**
 * Applies a boolean common using conservative settings.
 * Surface-bound extrudes constrain a prism by intersecting it with the host
 * face volume. Sharing the stable boolean setup avoids raw OCCT failures.
 */
export function applyStableBoolCommon(
  oc: OC,
  a: OC,
  b: OC,
  span: SourceSpan,
  failureMessage = 'Boolean common failed',
): OC {
  const Common = oc.BRepAlgoAPI_Common_3 ?? oc.BRepAlgoAPI_Common_2;
  if (typeof Common !== 'function') {
    throw occtError(
      'Boolean common is not available in this OpenCascade build',
      span,
    );
  }
  const common = new Common(a, b);
  try {
    configureBooleanBuilder(oc, common, { useGlue: false, simplify: false });
    common.Build?.();
    if (common.IsDone?.() === false) throw occtError(failureMessage, span);
    return common.Shape();
  } finally {
    common.delete?.();
  }
}

/**
 * Enables OCCT boolean settings when the loaded OpenCascade.js build exposes them.
 * OpenCascade.js versions expose slightly different bindings. Feature-testing
 * preserves compatibility while using glue/fuzzy/simplification support where
 * available.
 */
export function configureBooleanBuilder(
  oc: OC,
  builder: OC,
  options: StableBooleanOptions = {},
): void {
  builder.SetNonDestructive?.(true);
  builder.SetRunParallel?.(false);
  builder.SetFuzzyValue?.(BOOLEAN_TOLERANCE);

  const glueShift =
    oc.BOPAlgo_GlueEnum?.BOPAlgo_GlueShift ?? oc.BOPAlgo_GlueShift;
  if (options.useGlue !== false && glueShift !== undefined) {
    builder.SetGlue?.(glueShift);
  }
}

/** Validates a boolean result and repairs it only when OCCT reports invalidity. */
export function validOrHealedShape(
  oc: OC,
  shape: OC,
  span: SourceSpan,
  failureMessage: string,
): OC {
  if (isNullShape(shape)) throw occtError(failureMessage, span);
  if (isValidShape(oc, shape)) return shape;
  const healed = healShape(oc, shape);
  if (!healed || isNullShape(healed) || !isValidShape(oc, healed)) {
    throw occtError(failureMessage, span);
  }
  return healed;
}

/**
 * Returns whether the input meets the `valid shape` condition.
 */
function isValidShape(oc: OC, shape: OC): boolean {
  const Analyzer =
    oc.BRepCheck_Analyzer_2 ?? oc.BRepCheck_Analyzer_1 ?? oc.BRepCheck_Analyzer;
  if (typeof Analyzer !== 'function') return true;
  const analyzer = constructAnalyzer(Analyzer, shape);
  try {
    return analyzer.IsValid?.() !== false;
  } finally {
    analyzer.delete?.();
  }
}

/**
 * Handles construct analyzer in the operations flow.
 */
function constructAnalyzer(Analyzer: OC, shape: OC): OC {
  try {
    return new Analyzer(shape, false);
  } catch {
    return new Analyzer(shape);
  }
}

/**
 * Handles heal shape in the operations flow.
 */
function healShape(oc: OC, shape: OC): OC | null {
  const ShapeFix = oc.ShapeFix_Shape_2 ?? oc.ShapeFix_Shape;
  if (typeof ShapeFix !== 'function') return null;
  const fixer = new ShapeFix(shape);
  const progress = makeProgressRange(oc);
  try {
    configureShapeFixer(fixer);
    performShapeFix(fixer, progress);
    return fixer.Shape?.() ?? null;
  } finally {
    progress?.delete?.();
    fixer.delete?.();
  }
}

/**
 * Constructs progress range from the supplied values.
 */
function makeProgressRange(oc: OC): OC | null {
  return typeof oc.Message_ProgressRange_1 === 'function'
    ? new oc.Message_ProgressRange_1()
    : null;
}

/**
 * Configures shape fixer with the supplied options.
 */
function configureShapeFixer(fixer: OC): void {
  fixer.SetPrecision?.(BOOLEAN_TOLERANCE);
  fixer.SetMinTolerance?.(BOOLEAN_TOLERANCE / 10);
  fixer.SetMaxTolerance?.(BOOLEAN_TOLERANCE * 10);
}

/**
 * Handles perform shape fix in the operations flow.
 */
function performShapeFix(fixer: OC, progress: OC | null): void {
  if (progress) fixer.Perform(progress);
  else fixer.Perform?.();
}
