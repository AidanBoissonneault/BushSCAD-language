/**
 * @author Aidan Boissonneault
 * @file reference-syntax.ts
 * @purpose Provides reference syntax behavior for the references in IR package.
 * @last-edited October 6, 2026
 */

export const REFERENCE_FACE_DIRECTIONS = [
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
] as const;

/**
 * Derives `ReferenceFaceDirection` from `(typeof REFERENCE_FACE_DIRECTIONS)[number]` to preserve its
 * type relationship in the references layer.
 */
export type ReferenceFaceDirection = (typeof REFERENCE_FACE_DIRECTIONS)[number];

const REFERENCE_FACE_DIRECTION_SET = new Set<string>(REFERENCE_FACE_DIRECTIONS);
const REFERENCE_QUALIFIERS = new Set(['inner', 'outer']);
const REFERENCE_SUB_REFS = new Set(['edges', 'center', 'perimeter']);
const RESERVED_PRIMARY_SEGMENTS = new Set([
  ...REFERENCE_FACE_DIRECTIONS,
  'face',
  'side',
  'sides',
  'curved',
  'world',
  'width',
  'height',
  'length',
  'area',
  'normal',
  'x',
  'y',
  ...REFERENCE_SUB_REFS,
]);
const REMOVED_SELECTOR_CALLS = new Set(['side', 'corner', 'edge', 'face']);
const CORNER_ALIASES = new Set([
  'front_left',
  'front_right',
  'back_left',
  'back_right',
  'top_left',
  'top_right',
  'bottom_left',
  'bottom_right',
]);

/**
 * Options for normalize reference, including relative object name.
 */
export type NormalizeReferenceOptions = {
  relativeObjectName?: string | null;
};

/**
 * Returns true for the removed selector-call names.
 * The parser must reject the legacy public forms while downstream code can
 * continue consuming their canonical internal labels.
 */
export function isRemovedReferenceSelectorCall(name: string): boolean {
  return REMOVED_SELECTOR_CALLS.has(name);
}

/** Returns true when `name` is one of the six built-in face directions. */
export function isReferenceFaceDirection(
  name: string,
): name is ReferenceFaceDirection {
  return REFERENCE_FACE_DIRECTION_SET.has(name);
}

/** Returns true for built-in corner aliases such as `front_left`. */
export function isReferenceCornerAlias(name: string): boolean {
  return CORNER_ALIASES.has(name);
}

/** Returns the selected edge name for aliases such as `front_edge`. */
export function referenceEdgeAliasTarget(
  name: string,
): ReferenceFaceDirection | null {
  if (!name.endsWith('_edge')) return null;
  const direction = name.slice(0, -'_edge'.length);
  return isReferenceFaceDirection(direction) ? direction : null;
}

/**
 * Normalizes public dot-reference parts to the canonical internal label shape.
 * Users write concise references like `base.top.front_edge` and `vase.lip`,
 * while OCCT and existing IR consumers already understand
 * `base.top.edge.front` and `vase.face.lip`.
 */
export function normalizeReferenceParts(
  parts: string[],
  options: NormalizeReferenceOptions = {},
): string[] {
  let normalized = [...parts];
  const relativeObjectName = options.relativeObjectName ?? null;
  if (relativeObjectName && normalized.length > 0) {
    normalized = normalizeRelativeReferenceRoot(normalized, relativeObjectName);
  }

  const faceIndex = primaryFaceSegmentIndex(normalized);
  if (faceIndex !== null) {
    normalized = normalizePrimaryFaceSegment(normalized, faceIndex);
  }
  return normalizeFeatureAliases(normalized);
}

/**
 * Normalizes a serialized reference label.
 * Several packages exchange labels as strings, so keeping the string entry
 * point next to the array-based helper prevents drift in selector behavior.
 */
export function normalizeReferenceLabel(
  label: string,
  options: NormalizeReferenceOptions = {},
): string {
  return normalizeReferenceParts(label.split('.'), options).join('.');
}

/**
 * Normalizes relative reference root into the canonical form.
 */
function normalizeRelativeReferenceRoot(
  parts: string[],
  relativeObjectName: string,
): string[] {
  const first = parts[0];
  if (!first) return parts;
  if (isRelativeObjectFaceSegment(first)) return [relativeObjectName, ...parts];
  if (parts.length >= 2) return [relativeObjectName, 'face', ...parts];
  return parts;
}

/**
 * Returns whether the input meets the `relative object face segment` condition.
 */
function isRelativeObjectFaceSegment(segment: string): boolean {
  return (
    isReferenceFaceDirection(segment) ||
    segment === 'curved' ||
    REFERENCE_SUB_REFS.has(segment) ||
    referenceEdgeAliasTarget(segment) !== null ||
    isReferenceCornerAlias(segment)
  );
}

/**
 * Handles primary face segment index in the references flow.
 */
function primaryFaceSegmentIndex(parts: string[]): number | null {
  if (parts.length < 2) return null;
  let index = 1;
  if (REFERENCE_QUALIFIERS.has(parts[index] ?? '')) index++;
  return index < parts.length ? index : null;
}

/**
 * Normalizes primary face segment into the canonical form.
 */
function normalizePrimaryFaceSegment(parts: string[], index: number): string[] {
  const segment = parts[index];
  if (!segment || RESERVED_PRIMARY_SEGMENTS.has(segment)) return parts;
  if (isReferenceCornerAlias(segment) || referenceEdgeAliasTarget(segment)) {
    return parts;
  }
  return [...parts.slice(0, index), 'face', segment, ...parts.slice(index + 1)];
}

/**
 * Normalizes feature aliases into the canonical form.
 */
function normalizeFeatureAliases(parts: string[]): string[] {
  const normalized: string[] = [];
  for (const part of parts) {
    const previous = normalized.at(-1);
    if (previous === 'corner' || previous === 'edge' || previous === 'face') {
      normalized.push(part);
      continue;
    }
    const edgeTarget = referenceEdgeAliasTarget(part);
    if (edgeTarget) {
      normalized.push('edge', edgeTarget);
    } else if (isReferenceCornerAlias(part)) {
      normalized.push('corner', part);
    } else {
      normalized.push(part);
    }
  }
  return normalized;
}
