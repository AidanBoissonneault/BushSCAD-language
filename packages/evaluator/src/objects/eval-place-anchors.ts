/**
 * @author Aidan Boissonneault
 * @file eval-place-anchors.ts
 * @purpose Evaluates place anchors for the objects in evaluator package.
 * @last-edited October 6, 2026
 */

import type { AnchorDecl, FaceRef, PlaceStatement } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import {
  evalPlacement,
  serializeAnchorTarget,
} from '../expressions/eval-expressions.js';

const GENERATED_BOTTOM_FACE_OP_KINDS = new Set<EvalCtx['ops'][number]['kind']>([
  'extrude',
  'cut',
  'solid_cut',
  'revolve',
  'radial_extrude',
  'radial_cut',
  'loft',
  'sweep',
  'sweep_cut',
  'solidPrimitive',
]);

/**
 * Returns the implicit source anchor for reusable refs and objects.
 * A planted sketch line defines the side center used to place a ref when no
 * explicit source anchor is supplied. Without this, alignShape falls back to
 * the world axis and ignores the author-declared planted side.
 */
export function defaultRefSourceAnchor(
  refIrName: string,
  ctx: EvalCtx,
): string | null {
  const planted = ctx.plantAnchors.get(refIrName)?.ref;
  if (planted) return planted;
  return hasGeneratedBottomFace(ctx, refIrName)
    ? `${refIrName}.bottom.center`
    : null;
}

/**
 * Converts a source-anchor reference to the component-local anchor key.
 * `place(part, @target, @mount)` names an anchor inside the source component,
 * not a symbol in the caller's scope.
 */
export function sourceAnchorKey(
  sourceAnchor: PlaceStatement['sourceAnchor'],
  componentName: string,
): string | null {
  if (!sourceAnchor || sourceAnchor.kind !== 'faceRef') return null;
  const first = sourceAnchor.chain[0];
  if (!first || first.kind !== 'name') return null;
  if (sourceAnchor.chain.length === 1) return first.value;
  if (isQualifiedSourceAnchor(sourceAnchor, componentName)) {
    return sourceAnchor.chain[1].value;
  }
  return serializeFaceRefSegmentsRaw(sourceAnchor);
}

/**
 * Returns the display label for anchor placement.
 */
export function anchorPlacementLabel(
  point: AnchorDecl['point'],
  ctx: EvalCtx,
  rootObjectName: string | null,
): string {
  if (point.kind === 'faceRef') {
    return serializeAnchorTarget(point, ctx, rootObjectName);
  }
  return evalPlacement(point, ctx).faceRef;
}

/**
 * Detects generated solid sources that can use the built-in bottom face.
 * Imported/ref-extended shapes may not have BushSCAD-generated face labels, but
 * emitted solid ops do. Their default source anchor should be the bottom face
 * instead of the world axis, which would mate upside down at the origin.
 */
function hasGeneratedBottomFace(ctx: EvalCtx, refIrName: string): boolean {
  if (ctx.solidMetrics.has(refIrName)) return true;
  return ctx.ops.some((op) => generatedSourceOpMatches(op, refIrName));
}

/**
 * Handles generated source op matches in the objects flow.
 */
function generatedSourceOpMatches(
  op: EvalCtx['ops'][number],
  refIrName: string,
): boolean {
  return (
    GENERATED_BOTTOM_FACE_OP_KINDS.has(op.kind) &&
    'objName' in op &&
    op.objName === refIrName
  );
}

/**
 * Returns whether the input meets the `qualified source anchor` condition.
 */
function isQualifiedSourceAnchor(
  sourceAnchor: FaceRef,
  componentName: string,
): sourceAnchor is FaceRef & {
  chain: [
    { kind: 'name'; value: string },
    { kind: 'name'; value: string },
    ...FaceRef['chain'],
  ];
} {
  const first = sourceAnchor.chain[0];
  const second = sourceAnchor.chain[1];
  return (
    first?.kind === 'name' &&
    first.value === componentName &&
    sourceAnchor.chain.length === 2 &&
    second?.kind === 'name'
  );
}

/**
 * Handles serialize face ref segments raw in the objects flow.
 */
function serializeFaceRefSegmentsRaw(ref: FaceRef): string {
  return ref.chain.map(serializeFaceRefSegmentRaw).join('.');
}

/**
 * Serializes one face-reference segment for component-local anchor lookup.
 */
function serializeFaceRefSegmentRaw(segment: FaceRef['chain'][number]): string {
  switch (segment.kind) {
    case 'call':
      return `${segment.name}.${segment.arg}`;
    case 'edgeIntersection':
      return `(${segment.edges.join(',')})${segment.index === undefined ? '' : `[${segment.index}]`}`;
    case 'group':
      return segment.options.join('.');
    case 'index':
      return String(segment.value);
    case 'wildcard':
      return '*';
    case 'name':
      return segment.value;
  }
}
