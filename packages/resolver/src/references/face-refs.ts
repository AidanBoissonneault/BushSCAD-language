/**
 * @author Aidan Boissonneault
 * @file face-refs.ts
 * @purpose Provides face refs behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, FaceRef, RepeatableFaceRef } from '@bushscad/ir';
import {
  expandFaceRef,
  expandRepeatableFaceRef,
  normalizeReferenceParts,
} from '@bushscad/ir';
import { addError } from '../core/errors.js';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import type { ResolveExprFn } from './types.js';
import type { SelectorConsumer } from './selector-compatibility.js';
import {
  validateSelectorConsumer,
  validateSingleFaceRefConsumer,
} from './selector-consumer-validation.js';
import { validateEdgeIntersection } from './edge-intersection-validation.js';
import {
  resolvedSketchComponentMember,
  unresolvedSketchComponentPath,
} from './sketch-component-selection.js';

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
  'largest_planar',
  'smallest_planar',
]);

/**
 * Resolves a face reference root and any expression-backed face options.
 * Face references can expand to multiple concrete selectors, but every
 * concrete target must produce the same undefined-root diagnostics.
 */
export function resolveFaceRef(
  ref: FaceRef,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
  resolveExpr: ResolveExprFn,
  consumer?: SelectorConsumer,
): void {
  for (const concrete of expandFaceRef(ref)) {
    resolveConcreteFaceRef(concrete, scope, state, span);
  }
  if (consumer) {
    validateSingleFaceRefConsumer(ref, consumer, scope, state, span);
  }
  if (ref.surfaceAngle) resolveExpr(ref.surfaceAngle, scope, state);
}

/**
 * Resolves every concrete target produced by a repeatable face selector.
 * Array selectors are syntax sugar over repeated operations, so resolver
 * diagnostics must match the fully expanded references the evaluator emits.
 */
export function resolveRepeatableFaceRef(
  ref: RepeatableFaceRef,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
  resolveExpr: ResolveExprFn,
  consumer?: SelectorConsumer,
): void {
  for (const concrete of expandRepeatableFaceRef(ref)) {
    resolveConcreteFaceRef(concrete, scope, state, span);
    if (concrete.surfaceAngle) resolveExpr(concrete.surfaceAngle, scope, state);
  }
  if (consumer) validateSelectorConsumer(ref, consumer, scope, state, span);
}

/**
 * Resolves a single non-repeatable face selector root and named-face segment.
 * The parser permits face-word, global part, anchor, and relative named-face
 * roots. Keeping those cases separated makes the resolver diagnostics explicit.
 */
function resolveConcreteFaceRef(
  ref: FaceRef,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
): void {
  if (ref.chain.length === 0) return;
  validateEdgeIntersection(ref, scope, state, span);
  const rootName = faceRefRootName(ref);
  if (!rootName) return;

  const rootKnown = isKnownFaceRoot(rootName, scope, state);

  if (shouldReportUnknownRoot(rootName, rootKnown, ref)) {
    addError(state, `Undefined reference '${rootName}'`, span);
  }

  validateNamedFaceSegment(ref, rootName, rootKnown, scope, state, span);
}

/**
 * Resolves the face data required by the current selector.
 */
function faceRefRootName(ref: FaceRef): string {
  const first = ref.chain.find(
    (segment) =>
      segment.kind !== 'index' &&
      segment.kind !== 'wildcard' &&
      segment.kind !== 'edgeIntersection',
  );
  if (first?.kind === 'name') return first.value;
  if (first?.kind === 'call') return first.name;
  if (first?.kind === 'group') return first.options[0] ?? '';
  return '';
}

/**
 * Returns whether the input meets the `known face root` condition.
 */
function isKnownFaceRoot(
  rootName: string,
  scope: Scope,
  state: State,
): boolean {
  return (
    rootName === 'origin' ||
    scope.lookup(rootName) !== null ||
    state.globalParts.has(rootName) ||
    state.globalAnchors.has(rootName)
  );
}

/**
 * Determines whether report unknown root is required.
 */
function shouldReportUnknownRoot(
  rootName: string,
  rootKnown: boolean,
  ref: FaceRef,
): boolean {
  return (
    !rootKnown && !FACE_WORDS.has(rootName) && !isRelativeNamedFaceRef(ref)
  );
}

/**
 * Validates named face segment and reports any violations.
 */
function validateNamedFaceSegment(
  ref: FaceRef,
  rootName: string,
  rootKnown: boolean,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
): void {
  if (validateSketchComponentSegment(ref, scope, state, span)) return;
  const namedFace = refHasWildcard(ref) ? null : namedFaceFromRef(ref);
  if (!namedFace || !rootKnown || FACE_WORDS.has(rootName)) return;

  const segments = state.objectProfileSegments.get(rootName);
  if (segments?.has(namedFace)) return;
  addError(
    state,
    `Unknown named face '${namedFace}' on object '${rootName}'`,
    span,
  );
}

/**
 * Handles selector variables and sketch-component members before face names.
 */
function validateSketchComponentSegment(
  ref: FaceRef,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
): boolean {
  if (refUsesSelectorVariable(ref, scope)) return true;
  if (resolvedSketchComponentMember(ref, state)) return true;
  const unresolved = unresolvedSketchComponentPath(ref, state);
  if (!unresolved) return false;
  addError(
    state,
    `Unknown member '${unresolved.member}' on sketch component '${unresolved.component}' of object '${unresolved.owner}'`,
    ref.chain.at(-1)?.span ?? span,
  );
  return true;
}

/**
 * Detects evaluator-expanded selector variables before named-face validation.
 * A reference such as `@body.caps.edges` uses `caps` as an array selector when
 * it resolves to a variable. Treating it as a profile face makes valid selector
 * names depend accidentally on whether they are reserved face words.
 */
function refUsesSelectorVariable(ref: FaceRef, scope: Scope): boolean {
  return ref.chain
    .slice(1)
    .some(
      (segment) =>
        segment.kind === 'name' && scope.lookup(segment.value) === 'var',
    );
}

/**
 * Handles ref has wildcard in the references flow.
 */
function refHasWildcard(ref: FaceRef): boolean {
  return ref.chain.some((segment) => segment.kind === 'wildcard');
}

/**
 * Handles named face from ref in the references flow.
 */
function namedFaceFromRef(ref: FaceRef): string | null {
  const call = ref.chain.find(
    (segment): segment is Extract<FaceRef['chain'][number], { kind: 'call' }> =>
      segment.kind === 'call' && segment.name === 'face',
  );
  if (call) return call.arg;
  const parts = normalizeReferenceParts(rawRefParts(ref));
  const faceIndex = parts.indexOf('face');
  return faceIndex >= 0 ? (parts[faceIndex + 1] ?? null) : null;
}

/**
 * Handles raw ref parts in the references flow.
 */
function rawRefParts(ref: FaceRef): string[] {
  return ref.chain.flatMap((segment) =>
    segment.kind === 'call'
      ? [segment.name, segment.arg]
      : segment.kind === 'edgeIntersection'
        ? []
        : segment.kind === 'group'
          ? segment.options
          : segment.kind === 'index'
            ? []
            : segment.kind === 'wildcard'
              ? []
              : [segment.value],
  );
}

/**
 * Returns whether the input meets the `relative named face ref` condition.
 */
function isRelativeNamedFaceRef(ref: FaceRef): boolean {
  if (ref.chain.length < 2) return false;
  const first = ref.chain[0];
  if (!first || first.kind !== 'name' || FACE_WORDS.has(first.value)) {
    return false;
  }
  const second = ref.chain[1];
  return (
    second?.kind === 'name' &&
    (second.value === 'center' ||
      second.value === 'edges' ||
      second.value === 'perimeter')
  );
}
