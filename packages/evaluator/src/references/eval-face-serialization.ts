/**
 * @author Aidan Boissonneault
 * @file eval-face-serialization.ts
 * @purpose Evaluates face serialization for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import { normalizeReferenceParts, type FaceRef } from '@bushscad/ir';
import type {
  EvalCtx,
  EvalValue,
  FaceRefValue,
  PartSnapshot,
} from '../core/eval-types.js';
import { isFaceRefValue } from '../core/eval-types.js';

export const FACE_WORDS = new Set([
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
  'inner',
  'outer',
  'sides',
  'perimeter',
  'edges',
  'center',
  'side',
  'corner',
  'edge',
  'face',
  'curved',
  'world',
]);

/**
 * Handles raw face ref parts in the references flow.
 */
function rawFaceRefParts(
  chain: FaceRef['chain'],
  ctx: EvalCtx,
  mapFirst = true,
): string[] {
  return chain.flatMap((seg, i) =>
    rawFaceRefSegmentParts(seg, i, ctx, mapFirst),
  );
}

/**
 * Serializes one raw face-reference segment into its unnormalized parts.
 *
 * Why:
 * Face references need to retain segment-specific syntax until the caller
 * applies context-aware name mapping and normalization.
 */
export function rawFaceRefSegmentParts(
  seg: FaceRef['chain'][number],
  index: number,
  ctx: EvalCtx,
  mapFirst: boolean,
): string[] {
  switch (seg.kind) {
    case 'call':
      return rawCallSegmentParts(seg);
    case 'edgeIntersection': {
      const suffix = seg.index === undefined ? '' : `[${seg.index}]`;
      return [`(${seg.edges.join(',')})${suffix}`];
    }
    case 'group':
      return seg.options;
    case 'index':
      return [String(seg.value)];
    case 'wildcard':
      return ['*'];
    case 'name':
      return [
        index === 0 && mapFirst
          ? (ctx.names.get(seg.value) ?? seg.value)
          : seg.value,
      ];
  }
}

/**
 * Handles raw call segment parts in the references flow.
 */
function rawCallSegmentParts(
  seg: Extract<FaceRef['chain'][number], { kind: 'call' }>,
): string[] {
  const parts = [seg.name, seg.arg];
  for (const na of seg.namedArgs ?? []) parts.push(na.name, na.value);
  return parts;
}

/**
 * Handles serialize face ref segments in the references flow.
 */
export function serializeFaceRefSegments(
  chain: FaceRef['chain'],
  ctx: EvalCtx,
  mapFirst = true,
): string {
  return rawFaceRefParts(chain, ctx, mapFirst).join('.');
}

/**
 * Handles serialize normalized face ref segments in the references flow.
 */
function serializeNormalizedFaceRefSegments(
  chain: FaceRef['chain'],
  ctx: EvalCtx,
  mapFirst = true,
): string {
  return normalizeReferenceParts(rawFaceRefParts(chain, ctx, mapFirst)).join(
    '.',
  );
}

/**
 * Handles serialize face ref in the references flow.
 */
export function serializeFaceRef(ref: FaceRef, ctx: EvalCtx): string {
  const resolvedRef = materializeInlineObjectReference(ref, ctx);
  const tagRef = rootTagFaceRef(resolvedRef, ctx);
  if (tagRef) return tagRef;
  const partRef = partSnapshotFaceRef(resolvedRef, ctx);
  if (partRef) return partRef;
  return serializeNormalizedFaceRefSegments(resolvedRef.chain, ctx);
}

/** Lowers an inline operation once and replaces its synthetic reference root. */
export function materializeInlineObjectReference(
  ref: FaceRef,
  ctx: EvalCtx,
): FaceRef {
  const operation = ref.inlineOperation;
  if (!operation) return ref;

  let objectName = ctx.inlineObjectReferences.get(ref);
  if (!objectName) {
    objectName = ctx.evaluateInlineObjectOperation(operation, ctx);
    ctx.inlineObjectReferences.set(ref, objectName);
  }

  return {
    ...ref,
    inlineOperation: undefined,
    chain: [
      { kind: 'name', value: objectName, span: operation.span },
      ...ref.chain.slice(1),
    ],
  };
}

/**
 * Handles serialize anchor target in the references flow.
 */
export function serializeAnchorTarget(
  point: FaceRef,
  ctx: EvalCtx,
  relativeObjectName: string | null,
): string {
  const resolvedPoint = materializeInlineObjectReference(point, ctx);
  if (!relativeObjectName) return serializeFaceRef(resolvedPoint, ctx);

  const first = resolvedPoint.chain[0];
  const mappedRelativeObjectName =
    ctx.names.get(relativeObjectName) ?? relativeObjectName;
  if (
    first?.kind === 'name' &&
    (first.value === relativeObjectName ||
      first.value === mappedRelativeObjectName)
  ) {
    return serializeFaceRef(resolvedPoint, ctx);
  }
  return normalizeReferenceParts(rawFaceRefParts(resolvedPoint.chain, ctx, false), {
    relativeObjectName: mappedRelativeObjectName,
  }).join('.');
}

/**
 * Handles root tag face ref in the references flow.
 */
function rootTagFaceRef(ref: FaceRef, ctx: EvalCtx): string | null {
  const first = ref.chain[0];
  if (first?.kind !== 'name') return null;

  const tag =
    ctx.tags.get(first.value) ?? asFaceRefValue(ctx.values.get(first.value));
  if (!tag) return null;
  return appendFaceRefSuffix(tag.label, ref.chain.slice(1), ctx);
}

/**
 * Handles part snapshot face ref in the references flow.
 */
function partSnapshotFaceRef(ref: FaceRef, ctx: EvalCtx): string | null {
  const partSnap = partSnapshotForRef(ref, ctx);
  if (!partSnap) return null;
  const second = ref.chain[1];

  if (isFaceWordSegment(second))
    return serializeNormalizedFaceRefSegments(ref.chain, ctx, false);

  const rootLabel = partSnapshotObjectLabel(partSnap, second);
  return rootLabel
    ? appendFaceRefSuffix(rootLabel, ref.chain.slice(2), ctx)
    : null;
}

/**
 * Handles part snapshot for ref in the references flow.
 */
function partSnapshotForRef(ref: FaceRef, ctx: EvalCtx): PartSnapshot | null {
  const first = ref.chain[0];
  if (first?.kind !== 'name' || ref.chain.length < 2) return null;
  return ctx.partsSnapshot.get(first.value) ?? null;
}

/**
 * Returns the display label for part snapshot object.
 */
function partSnapshotObjectLabel(
  partSnap: PartSnapshot,
  segment: FaceRef['chain'][number] | undefined,
): string | null {
  if (segment?.kind !== 'name') return null;
  return (
    partSnap.tags.get(segment.value)?.label ??
    partSnap.names.get(segment.value) ??
    segment.value
  );
}

/**
 * Appends face ref suffix to the current output.
 */
function appendFaceRefSuffix(
  rootLabel: string,
  suffixChain: FaceRef['chain'],
  ctx: EvalCtx,
): string {
  const suffix = serializeNormalizedFaceRefSegments(suffixChain, ctx, false);
  return suffix ? `${rootLabel}.${suffix}` : rootLabel;
}

/**
 * Detects part-level face refs before part snapshot object lookup.
 *
 * `box.top.center` targets the completed part shape, while `box.body.top`
 * targets a named object inside that part. Without this guard, `top` is
 * mistaken for an object name and the root becomes `top.center`.
 */
function isFaceWordSegment(
  segment: FaceRef['chain'][number] | undefined,
): boolean {
  if (!segment) return false;
  if (segment.kind === 'group') {
    return segment.options.some((option) => FACE_WORDS.has(option));
  }
  if (segment.kind === 'edgeIntersection') return false;
  if (segment.kind === 'index') return false;
  if (segment.kind === 'wildcard') return true;
  return segment.kind === 'call'
    ? FACE_WORDS.has(segment.name)
    : FACE_WORDS.has(segment.value);
}

/**
 * Handles as face ref value in the references flow.
 */
export function asFaceRefValue(
  value: EvalValue | undefined,
): FaceRefValue | null {
  return isFaceRefValue(value) ? value : null;
}
