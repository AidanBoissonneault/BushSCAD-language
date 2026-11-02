/**
 * @author Aidan Boissonneault
 * @file edge-intersection-validation.ts
 * @purpose Provides edge intersection validation behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, FaceRef } from '@bushscad/ir';
import { addError } from '../core/errors.js';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';

/**
 * Validates the authored edge operands of one geometric intersection selector.
 * The actual crossing count is topology-dependent and belongs to OCCT, but
 * misspelled edge aliases and invalid selector placement should fail during
 * normal name resolution with precise source spans.
 */
export function validateEdgeIntersection(
  ref: FaceRef,
  scope: Scope,
  state: State,
  fallbackSpan: ASTSourceSpan,
): void {
  const position = ref.chain.findIndex(
    (segment) => segment.kind === 'edgeIntersection',
  );
  if (position < 0) return;
  const segment = ref.chain[position];
  if (segment?.kind !== 'edgeIntersection') return;

  if (position !== ref.chain.length - 1) {
    addError(
      state,
      'An edge intersection must be the final selector segment',
      segment.span,
    );
  }
  if (segment.edges[0] === segment.edges[1]) {
    addError(
      state,
      'An edge intersection requires two different named edges',
      segment.span,
    );
  }

  const owner = scopedOwner(ref, position);
  if (owner) {
    validateScopedEdges(segment, owner, state);
  } else {
    validateAliasedEdges(segment, scope, state, fallbackSpan);
  }
}

/**
 * Handles scoped owner in the references flow.
 */
function scopedOwner(ref: FaceRef, position: number): string | null {
  if (position !== 1) return null;
  const root = ref.chain[0];
  return root?.kind === 'name' ? root.value : null;
}

/**
 * Validates scoped edges and reports any violations.
 */
function validateScopedEdges(
  segment: Extract<FaceRef['chain'][number], { kind: 'edgeIntersection' }>,
  owner: string,
  state: State,
): void {
  const known = state.objectProfileSegments.get(owner);
  for (const [index, edge] of segment.edges.entries()) {
    if (known?.has(edge)) continue;
    addError(
      state,
      `Unknown named edge '${edge}' on object '${owner}'`,
      segment.memberSpans[index] ?? segment.span,
    );
  }
}

/**
 * Validates aliased edges and reports any violations.
 */
function validateAliasedEdges(
  segment: Extract<FaceRef['chain'][number], { kind: 'edgeIntersection' }>,
  scope: Scope,
  state: State,
  fallbackSpan: ASTSourceSpan,
): void {
  for (const [index, edge] of segment.edges.entries()) {
    const kind = state.selectorAliases.get(edge);
    if (
      scope.lookup(edge) !== null &&
      (kind === 'named-edge' ||
        kind === 'face' ||
        kind === 'face-edges' ||
        kind === 'object-edges' ||
        kind === 'edge-intersection')
    ) {
      continue;
    }
    addError(
      state,
      `Unscoped intersection edge '${edge}' must be an edge-bearing @ alias; use @object.(${segment.edges.join(', ')})`,
      segment.memberSpans[index] ?? fallbackSpan,
    );
  }
}
