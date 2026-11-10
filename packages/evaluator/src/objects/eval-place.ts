/**
 * @author Aidan Boissonneault
 * @file eval-place.ts
 * @purpose Evaluates place for the objects in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  AnchorDecl,
  ASTSourceSpan,
  ComponentBody,
  Expr,
  FnDecl,
  IRAlignShape,
  IRPlacement,
  PlaceStatement,
} from '@bushscad/ir';
import {
  addError,
  childCtx,
  fresh,
  metricsForPlacement,
  toSpan,
} from '../core/eval-context.js';
import type { Deferred, EvalCtx, FaceMetrics } from '../core/eval-types.js';
import { evalRepeatablePlacements } from '../references/eval-repeatable-refs.js';
import { collectAnchors } from '../statements/eval-body-anchors.js';
import { collectBodyLocalNames } from '../statements/eval-body-local-names.js';
import { collectBodyObjectNames } from '../statements/eval-body-object-names.js';
import { placementAnchorFromLabel } from '../references/eval-anchor-resolution.js';
import { evaluatePartMetadata } from '../metadata/eval-metadata.js';
import { withPlacementRotation } from './eval-place-rotation.js';
import {
  anchorPlacementLabel,
  defaultRefSourceAnchor,
  sourceAnchorKey,
} from './eval-place-anchors.js';

/**
 * Place eval callbacks, including eval body statements and eval function.
 */
interface PlaceEvalCallbacks {
  evalBodyStatements: (
    body: ComponentBody,
    ctx: EvalCtx,
    deferred: Deferred,
  ) => void;
  evalFunction: (
    fn: FnDecl,
    args: Expr[],
    namedArgs: { name: string; value: Expr }[],
    ctx: EvalCtx,
    deferred: Deferred,
    placement: IRPlacement | null,
    thisContext: FaceMetrics | null,
    span: ASTSourceSpan,
    linkSpan: ASTSourceSpan,
  ) => EvalCtx;
}

/**
 * Evaluates a place statement into component/function/ref placement IR.
 * Public `@` placement syntax lowers to the same internal placement model as
 * earlier syntax, while component source anchors need local component scope.
 */
export function evalPlace(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  callbacks: PlaceEvalCallbacks,
): void {
  const targetPlacements = stmt.target
    ? evalRepeatablePlacements(stmt.target, ctx)
    : [{ faceRef: '0,0,0' }];
  for (const targetPlacement of targetPlacements) {
    placeAtTarget(stmt, ctx, deferred, callbacks, targetPlacement);
  }
}

/**
 * Emits one placed instance for a concrete target in a repeatable selector.
 *
 * Why:
 * Keeping single-target lowering here makes wildcard and ordinary placements
 * share the same function, reusable-ref, and component behavior.
 */
function placeAtTarget(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  callbacks: PlaceEvalCallbacks,
  targetPlacement: IRPlacement,
): void {
  const placement = withPlacementRotation(targetPlacement, stmt.rotate, ctx);
  const thisContext = metricsForPlacement(ctx, placement);

  if (placeFunction(stmt, ctx, deferred, callbacks, placement, thisContext))
    return;
  if (placeReusableRef(stmt, ctx, placement)) return;
  placeComponentBody(stmt, ctx, deferred, callbacks, placement, thisContext);
}

/**
 * Handles place component body in the objects flow.
 */
function placeComponentBody(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  callbacks: PlaceEvalCallbacks,
  placement: IRPlacement,
  thisContext: FaceMetrics | null,
): void {
  const compBody = ctx.components.get(stmt.component);
  if (!compBody) {
    addError(ctx, `Unknown component '${stmt.component}' in place`, stmt.span);
    return;
  }

  const objectNames = collectBodyObjectNames(compBody, ctx.bodyNameFacts);
  const rootObjectName = objectNames[0] ?? null;
  const placeCtx = createComponentPlaceContext(compBody, stmt, ctx);
  let anchorRef = initialComponentAnchorRef(
    compBody,
    stmt,
    ctx,
    placeCtx,
    rootObjectName,
  );
  const instancePlacement = anchorRef ? { ...placement, anchorRef } : placement;
  placeCtx.activePlacement = instancePlacement;
  placeCtx.thisContext = thisContext;

  const placeDeferred: Deferred = [];
  callbacks.evalBodyStatements(compBody, placeCtx, placeDeferred);
  anchorRef = applyFallbackAnchorRef(
    anchorRef,
    rootObjectName,
    placeCtx,
    instancePlacement,
  );
  applyAnchorMetadata(anchorRef, placeCtx, instancePlacement);
  registerPlacedComponentRoot(stmt, ctx, placeCtx, objectNames);
  deferred.push(...placeDeferred);
}

/**
 * Creates component place context with the supplied values.
 */
function createComponentPlaceContext(
  compBody: ComponentBody,
  stmt: PlaceStatement,
  ctx: EvalCtx,
): EvalCtx {
  const placeCtx = childCtx(ctx);
  const metadata = evaluatePartMetadata(compBody, placeCtx);
  placeCtx.activeColor = metadata.color ?? ctx.activeColor;
  placeCtx.activeMaterial = metadata.material ?? ctx.activeMaterial;
  placeCtx.materialScopes.push(stmt.component);
  for (const n of collectBodyLocalNames(compBody, ctx.bodyNameFacts)) {
    placeCtx.names.set(n, fresh(ctx, n));
  }
  return placeCtx;
}

/**
 * Handles initial component anchor ref in the objects flow.
 */
function initialComponentAnchorRef(
  compBody: ComponentBody,
  stmt: PlaceStatement,
  ctx: EvalCtx,
  placeCtx: EvalCtx,
  rootObjectName: string | null,
): string | undefined {
  const anchor = componentSourceAnchor(compBody, stmt, ctx);
  return anchor
    ? anchorPlacementLabel(anchor.point, placeCtx, rootObjectName)
    : undefined;
}

/**
 * Builds the component data required by the current operation.
 */
function componentSourceAnchor(
  compBody: ComponentBody,
  stmt: PlaceStatement,
  ctx: EvalCtx,
): AnchorDecl | undefined {
  const anchors = collectAnchors(compBody);
  const sourceAnchorName = sourceAnchorKey(stmt.sourceAnchor, stmt.component);
  reportUnknownSourceAnchor(sourceAnchorName, anchors, stmt, ctx);
  return sourceAnchorName !== null
    ? anchors.get(sourceAnchorName)
    : anchors.get(stmt.component);
}

/**
 * Handles report unknown source anchor in the objects flow.
 */
function reportUnknownSourceAnchor(
  sourceAnchorName: string | null,
  anchors: Map<string, AnchorDecl>,
  stmt: PlaceStatement,
  ctx: EvalCtx,
): void {
  if (sourceAnchorName === null || anchors.has(sourceAnchorName)) return;
  addError(
    ctx,
    `Unknown anchor '${sourceAnchorName}' on component '${stmt.component}'`,
    stmt.span,
  );
}

/**
 * Applies fallback anchor ref to the supplied state or geometry.
 */
function applyFallbackAnchorRef(
  anchorRef: string | undefined,
  rootObjectName: string | null,
  placeCtx: EvalCtx,
  instancePlacement: IRPlacement,
): string | undefined {
  if (anchorRef || !rootObjectName) return anchorRef;
  const rootName = placeCtx.names.get(rootObjectName) ?? rootObjectName;
  const fallbackRef = defaultRefSourceAnchor(rootName, placeCtx) ?? undefined;
  if (fallbackRef) instancePlacement.anchorRef = fallbackRef;
  return fallbackRef;
}

/**
 * Applies anchor metadata to the supplied state or geometry.
 */
function applyAnchorMetadata(
  anchorRef: string | undefined,
  placeCtx: EvalCtx,
  instancePlacement: IRPlacement,
): void {
  if (!anchorRef) return;
  const anchorMetadata = placementAnchorFromLabel(anchorRef, placeCtx);
  if (anchorMetadata) instancePlacement.anchor = anchorMetadata;
}

/**
 * Handles register placed component root in the objects flow.
 */
function registerPlacedComponentRoot(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  placeCtx: EvalCtx,
  objectNames: readonly string[],
): void {
  if (objectNames.length === 0) return;
  const rootName = placeCtx.names.get(objectNames[0]) ?? objectNames[0];
  ctx.placedInstanceRoots.set(stmt.component, rootName);
  if (stmt.as) {
    ctx.placedInstanceRoots.set(stmt.as, rootName);
    ctx.names.set(stmt.as, rootName);
  }
}

/**
 * Handles place function in the objects flow.
 */
function placeFunction(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  deferred: Deferred,
  callbacks: PlaceEvalCallbacks,
  placement: IRPlacement,
  thisContext: FaceMetrics | null,
): boolean {
  const fn = ctx.functions.get(stmt.component);
  if (!fn) return false;

  const fnCtx = callbacks.evalFunction(
    fn,
    stmt.args,
    stmt.namedArgs,
    ctx,
    deferred,
    placement,
    thisContext,
    stmt.span,
    stmt.nameSpan ?? stmt.span,
  );
  registerPlacedFunctionAlias(stmt, ctx, fn, fnCtx);
  return true;
}

/**
 * Handles register placed function alias in the objects flow.
 */
function registerPlacedFunctionAlias(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  fn: FnDecl,
  fnCtx: EvalCtx,
): void {
  if (!stmt.as) return;
  const objNames = collectBodyObjectNames(fn.body, ctx.bodyNameFacts);
  if (objNames.length === 0) return;
  const irName = fnCtx.names.get(objNames[0]) ?? objNames[0];
  ctx.placedInstanceRoots.set(stmt.as, irName);
  ctx.names.set(stmt.as, irName);
}

/**
 * Handles place reusable ref in the objects flow.
 */
function placeReusableRef(
  stmt: PlaceStatement,
  ctx: EvalCtx,
  placement: IRPlacement,
): boolean {
  if (!ctx.refBases.has(stmt.component)) return false;

  const refIrName = ctx.refBases.get(stmt.component)!;
  const instanceName = fresh(ctx, stmt.component);
  const sourceRef = stmt.sourceAnchor
    ? evalRepeatablePlacements(stmt.sourceAnchor, ctx)[0].faceRef
    : defaultRefSourceAnchor(refIrName, ctx);
  ctx.ops.push({
    kind: 'alignShape',
    name: refIrName,
    instanceName,
    sourceRef,
    targetPlacement: placement,
    span: toSpan(stmt.span),
  } satisfies IRAlignShape);
  ctx.placedInstanceRoots.set(stmt.component, instanceName);
  ctx.names.set(stmt.component, instanceName);
  if (stmt.as) {
    ctx.placedInstanceRoots.set(stmt.as, instanceName);
    ctx.names.set(stmt.as, instanceName);
  }
  return true;
}
