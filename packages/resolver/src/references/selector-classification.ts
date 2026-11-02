/**
 * @author Aidan Boissonneault
 * @file selector-classification.ts
 * @purpose Provides selector classification behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { FaceRef } from '@bushscad/ir';
import {
  isReferenceCornerAlias,
  normalizeReferenceParts,
  referenceEdgeAliasTarget,
} from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import type { SelectorKind } from './selector-compatibility.js';
import { resolvedSketchComponentMember } from './sketch-component-selection.js';

const FACE_ROOTS = new Set([
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
  'curved',
  'world',
  'largest_planar',
  'smallest_planar',
]);

/** Classifies source syntax, retaining whether it expands into multiple targets. */
export function classifyFaceRefSelector(
  ref: FaceRef,
  scope: Scope,
  state?: State,
): SelectorKind {
  return refHasExpansion(ref, scope)
    ? 'expanded-selection'
    : classifyConcreteFaceRefSelector(ref, scope, state);
}

/**
 * Classifies one concrete selector by the topology its consumer receives.
 * Compatibility must be checked after group expansion as well as at the group
 * envelope. Ignoring `expandedFrom` here preserves the concrete member kind.
 */
export function classifyConcreteFaceRefSelector(
  ref: FaceRef,
  scope: Scope,
  state?: State,
): SelectorKind {
  if (state && resolvedSketchComponentMember(ref, state)) return 'named-edge';
  if (ref.chain.some((segment) => segment.kind === 'edgeIntersection')) {
    return 'edge-intersection';
  }
  const parts = normalizeReferenceParts(rawReferenceParts(ref));
  if (parts.includes('corner') || parts.some(isReferenceCornerAlias)) {
    return 'named-corner';
  }
  if (parts.includes('edge') || parts.some(hasEdgeAlias)) return 'named-edge';
  if (parts.at(-1) === 'center') return 'face-point';
  if (parts.length === 1)
    return classifySingleRoot(parts[0] ?? '', scope, state);
  if (parts.length === 2 && parts[1] === 'perimeter') {
    return 'object-perimeter';
  }
  if (parts.length === 2 && parts[1] === 'edges') return 'object-edges';
  if (parts.at(-1) === 'perimeter') return 'face-perimeter';
  if (parts.at(-1) === 'edges') return 'face-edges';
  return 'face';
}

/**
 * Handles ref has expansion in the references flow.
 */
function refHasExpansion(ref: FaceRef, scope: Scope): boolean {
  return ref.chain.some(
    (segment) =>
      segment.kind === 'group' ||
      segment.kind === 'wildcard' ||
      segment.expandedFrom !== undefined ||
      (segment.kind === 'name' && scope.lookup(segment.value) === 'var'),
  );
}

/**
 * Handles classify single root in the references flow.
 */
function classifySingleRoot(
  root: string,
  scope: Scope,
  state?: State,
): SelectorKind {
  if (FACE_ROOTS.has(root)) return 'face';
  const aliasKind = state?.selectorAliases.get(root);
  if (aliasKind) return aliasKind;
  const kind = scope.lookup(root);
  if (kind === 'sketch') return 'sketch-boundary';
  if (
    kind === 'anchor' ||
    kind === 'plane' ||
    kind === 'binding' ||
    state?.globalAnchors.has(root)
  ) {
    return 'face-point';
  }
  return 'bare-object';
}

/**
 * Handles raw reference parts in the references flow.
 */
function rawReferenceParts(ref: FaceRef): string[] {
  return ref.chain.flatMap((segment) => {
    if (segment.kind === 'name') return [segment.value];
    if (segment.kind === 'edgeIntersection') return [];
    if (segment.kind === 'call') return [segment.name, segment.arg];
    if (segment.kind === 'group') return segment.options;
    return [];
  });
}

/**
 * Checks whether the input has edge alias.
 */
function hasEdgeAlias(value: string): boolean {
  return referenceEdgeAliasTarget(value) !== null;
}
