/**
 * @author Aidan Boissonneault
 * @file resolved-selection.ts
 * @purpose Provides resolved selection behavior for the references in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '../ast/sourceSpan.js';

/**
 * Accepted values for resolved selector kind are 'bare-object', 'sketch-boundary', 'face',
 * 'face-point', 'face-perimeter', 'face-edges', 'named-edge', 'edge-intersection',
 * 'named-corner', 'object-perimeter', 'object-edges', and 'expanded-selection'.
 */
export type ResolvedSelectorKind =
  | 'bare-object'
  | 'sketch-boundary'
  | 'face'
  | 'face-point'
  | 'face-perimeter'
  | 'face-edges'
  | 'named-edge'
  | 'edge-intersection'
  | 'named-corner'
  | 'object-perimeter'
  | 'object-edges'
  | 'expanded-selection';

/**
 * Accepted values for resolved topology kind are 'object', 'face', 'loop', 'edge', 'vertex', and
 * 'point'.
 */
export type ResolvedTopologyKind =
  | 'object'
  | 'face'
  | 'loop'
  | 'edge'
  | 'vertex'
  | 'point';

/**
 * Resolved loop membership, including scope and includes.
 */
export type ResolvedLoopMembership = {
  scope: 'face' | 'object';
  includes: 'outer-only' | 'outer-and-inner';
};

/**
 * Resolved selection source segment, including span and expanded from.
 */
export type ResolvedSelectionSourceSegment = {
  span: ASTSourceSpan;
  expandedFrom?: ASTSourceSpan;
};

/**
 * Target for resolved selection, including identifier, display label, owner entity, selector
 * kind, and topology kind.
 */
export type ResolvedSelectionTarget = {
  id: string;
  label: string;
  ownerEntity: string;
  selectorKind: Exclude<ResolvedSelectorKind, 'expanded-selection'>;
  topologyKind: ResolvedTopologyKind;
  loopMembership?: ResolvedLoopMembership;
  edgeIntersection?: {
    edgeLabels: readonly [string, string];
    index?: number;
  };
  sketchComponent?: {
    componentPath: readonly string[];
    member: string;
  };
  source: {
    selectorSpan: ASTSourceSpan;
    segmentSpans: ResolvedSelectionSourceSegment[];
  };
};

/**
 * Plain-data selector result transported between compiler and geometry layers.
 *
 * Compatibility labels remain on targets for legacy OCCT APIs, while stable
 * IDs, topology intent, loop semantics, and source provenance prevent those
 * APIs from silently widening a requested edge or loop back to its parent face.
 */
export type ResolvedSelection = {
  requestedKind: ResolvedSelectorKind;
  ownerEntity: string;
  targets: ResolvedSelectionTarget[];
  sourceSpan: ASTSourceSpan;
};

/** Returns the topology category a concrete selector is required to realize. */
export function topologyKindForSelector(
  kind: Exclude<ResolvedSelectorKind, 'expanded-selection'>,
): ResolvedTopologyKind {
  switch (kind) {
    case 'bare-object':
      return 'object';
    case 'sketch-boundary':
    case 'face-perimeter':
    case 'object-perimeter':
      return 'loop';
    case 'face':
      return 'face';
    case 'face-point':
      return 'point';
    case 'face-edges':
    case 'named-edge':
    case 'edge-intersection':
    case 'object-edges':
      return 'edge';
    case 'named-corner':
      return 'vertex';
  }
}
