/**
 * @author Aidan Boissonneault
 * @file eval-resolved-selection.ts
 * @purpose Evaluates resolved selection for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  FaceRef,
  RepeatableFaceRef,
  ResolvedSelection,
  ResolvedSelectionTarget,
  ResolvedSelectorKind,
} from '@bushscad/ir';
import {
  isReferenceCornerAlias,
  normalizeReferenceLabel,
  referenceEdgeAliasTarget,
  topologyKindForSelector,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { serializeFaceRef } from './eval-face-serialization.js';
import { expandRepeatableFaceRefForEval } from './eval-reference-expansion.js';
import { evalEdgeIntersection } from './eval-edge-intersection.js';
import { evalSketchComponentSelection } from './eval-sketch-component-selection.js';

/**
 * Accepted values for context for selection are 'fill', 'placement', 'sketch-on-surface',
 * 'fillet', 'chamfer', 'draft', 'revolve-axis', 'measurement', and 'selection-highlight'.
 */
export type SelectionContext =
  | 'fill'
  | 'placement'
  | 'sketch-on-surface'
  | 'fillet'
  | 'chamfer'
  | 'draft'
  | 'revolve-axis'
  | 'measurement'
  | 'selection-highlight';

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

/**
 * Expands and resolves a source selector without discarding source identity.
 *
 * Targets are de-duplicated by stable semantic identity in source order. The
 * compatibility label remains available while topology kind and loop intent
 * travel explicitly to OCCT and future interaction consumers.
 */
export function evalResolvedSelection(
  ref: RepeatableFaceRef,
  ctx: EvalCtx,
  context: SelectionContext,
): ResolvedSelection {
  const concrete = expandRepeatableFaceRefForEval(ref, ctx);
  const targets = uniqueTargets(
    concrete.map((target) => resolvedTarget(target, ref.span, ctx, context)),
  );
  return {
    requestedKind: requestedKind(ref, concrete, targets),
    ownerEntity: targets[0]?.ownerEntity ?? '',
    targets,
    sourceSpan: ref.span,
  };
}

/** Evaluates a selector whose consumer requires exactly one concrete target. */
export function evalSingularSelection(
  ref: RepeatableFaceRef,
  ctx: EvalCtx,
  context: SelectionContext,
): ResolvedSelection {
  const selection = evalResolvedSelection(ref, ctx, context);
  if (selection.targets.length !== 1) {
    addError(
      ctx,
      `${context} requires exactly one selector target; received ${selection.targets.length}`,
      ref.span,
    );
  }
  return selection;
}

/**
 * Handles resolved target in the references flow.
 */
function resolvedTarget(
  ref: FaceRef,
  selectorSpan: FaceRef['span'],
  ctx: EvalCtx,
  context: SelectionContext,
): ResolvedSelectionTarget {
  const intersection = evalEdgeIntersection(ref, ctx);
  if (intersection) {
    return {
      id: `${intersection.ownerEntity}:edge-intersection:${intersection.label}`,
      label: intersection.label,
      ownerEntity: intersection.ownerEntity,
      selectorKind: 'edge-intersection',
      topologyKind: 'edge',
      edgeIntersection: {
        edgeLabels: intersection.edgeLabels,
        ...(intersection.index === undefined
          ? {}
          : { index: intersection.index }),
      },
      source: {
        selectorSpan,
        segmentSpans: ref.chain.map((segment) => ({
          span: segment.span,
          ...(segment.expandedFrom
            ? { expandedFrom: segment.expandedFrom }
            : {}),
        })),
      },
    };
  }
  const component = evalSketchComponentSelection(ref, ctx);
  if (component) {
    return {
      id: `${component.ownerEntity}:named-edge:${component.label}`,
      label: component.label,
      ownerEntity: component.ownerEntity,
      selectorKind: 'named-edge',
      topologyKind: 'edge',
      sketchComponent: {
        componentPath: component.componentPath,
        member: component.member,
      },
      source: {
        selectorSpan,
        segmentSpans: ref.chain.map((segment) => ({ span: segment.span })),
      },
    };
  }
  const label = normalizeReferenceLabel(serializeFaceRef(ref, ctx));
  const parts = label.split('.').filter(Boolean);
  const selectorKind = concreteSelectorKind(parts, context);
  const ownerEntity = parts[0] ?? label;
  const membership = loopMembership(selectorKind);
  return {
    id: `${ownerEntity}:${selectorKind}:${label}`,
    label,
    ownerEntity,
    selectorKind,
    topologyKind: topologyKindForSelector(selectorKind),
    ...(membership ? { loopMembership: membership } : {}),
    source: {
      selectorSpan,
      segmentSpans: ref.chain.map((segment) => ({
        span: segment.span,
        ...(segment.expandedFrom ? { expandedFrom: segment.expandedFrom } : {}),
      })),
    },
  };
}

/**
 * Handles concrete selector kind in the references flow.
 */
function concreteSelectorKind(
  parts: string[],
  context: SelectionContext,
): Exclude<ResolvedSelectorKind, 'expanded-selection'> {
  const namedKind = namedSelectorKind(parts);
  if (namedKind) return namedKind;
  return nonNamedSelectorKind(parts, context);
}

/**
 * Handles non named selector kind in the references flow.
 */
function nonNamedSelectorKind(
  parts: string[],
  context: SelectionContext,
): Exclude<
  ResolvedSelectorKind,
  'expanded-selection' | 'named-edge' | 'named-corner'
> {
  if (parts.at(-1) === 'center') return 'face-point';
  if (parts.length === 1) return singleRootKind(parts[0] ?? '', context);
  return parts.length === 2
    ? objectScopedSelectorKind(parts[1] ?? '')
    : faceScopedSelectorKind(parts.at(-1) ?? '');
}

/**
 * Handles object scoped selector kind in the references flow.
 */
function objectScopedSelectorKind(
  terminal: string,
): 'object-perimeter' | 'object-edges' | 'face' {
  if (terminal === 'perimeter') return 'object-perimeter';
  return terminal === 'edges' ? 'object-edges' : 'face';
}

/**
 * Resolves the face data required by the current selector.
 */
function faceScopedSelectorKind(
  terminal: string,
): 'face-perimeter' | 'face-edges' | 'face' {
  if (terminal === 'perimeter') return 'face-perimeter';
  return terminal === 'edges' ? 'face-edges' : 'face';
}

/**
 * Handles named selector kind in the references flow.
 */
function namedSelectorKind(
  parts: string[],
): 'named-corner' | 'named-edge' | null {
  if (parts.includes('corner') || parts.some(isReferenceCornerAlias)) {
    return 'named-corner';
  }
  return parts.includes('edge') || parts.some(isEdgeAlias)
    ? 'named-edge'
    : null;
}

/**
 * Returns whether the input meets the `edge alias` condition.
 */
function isEdgeAlias(part: string): boolean {
  return referenceEdgeAliasTarget(part) !== null;
}

/**
 * Handles single root kind in the references flow.
 */
function singleRootKind(
  root: string,
  context: SelectionContext,
): 'sketch-boundary' | 'face' | 'face-point' | 'bare-object' {
  if (context === 'fill') return 'sketch-boundary';
  if (FACE_ROOTS.has(root)) return 'face';
  return isPointContext(context) ? 'face-point' : 'bare-object';
}

/**
 * Returns whether the input meets the `point context` condition.
 */
function isPointContext(context: SelectionContext): boolean {
  return (
    context === 'placement' ||
    context === 'sketch-on-surface' ||
    context === 'revolve-axis'
  );
}

/**
 * Handles requested kind in the references flow.
 */
function requestedKind(
  ref: RepeatableFaceRef,
  concrete: FaceRef[],
  targets: ResolvedSelectionTarget[],
): ResolvedSelectorKind {
  if (
    ref.kind === 'faceRefList' ||
    concrete.length > 1 ||
    concrete.some((item) =>
      item.chain.some((segment) => segment.expandedFrom !== undefined),
    )
  ) {
    return 'expanded-selection';
  }
  return targets[0]?.selectorKind ?? 'expanded-selection';
}

/**
 * Handles loop membership in the references flow.
 */
function loopMembership(
  kind: Exclude<ResolvedSelectorKind, 'expanded-selection'>,
): ResolvedSelectionTarget['loopMembership'] | undefined {
  if (kind === 'face-perimeter') {
    return { scope: 'face', includes: 'outer-only' };
  }
  if (kind === 'object-perimeter') {
    return { scope: 'object', includes: 'outer-only' };
  }
  if (kind === 'face-edges') {
    return { scope: 'face', includes: 'outer-and-inner' };
  }
  return undefined;
}

/**
 * Removes duplicate targets values while preserving their first occurrence.
 */
function uniqueTargets(
  targets: ResolvedSelectionTarget[],
): ResolvedSelectionTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.id)) return false;
    seen.add(target.id);
    return true;
  });
}
