/**
 * @author Aidan Boissonneault
 * @file selector-consumer-validation.ts
 * @purpose Provides selector consumer validation behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, FaceRef, RepeatableFaceRef } from '@bushscad/ir';
import { expandRepeatableFaceRef } from '@bushscad/ir';
import { addError } from '../core/errors.js';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import {
  selectorConsumerCompatibility,
  selectorConsumerDiagnostic,
  type SelectorConsumer,
} from './selector-compatibility.js';
import {
  classifyConcreteFaceRefSelector,
  classifyFaceRefSelector,
} from './selector-classification.js';

/**
 * Validates both an expansion envelope and every concrete selector member.
 *
 * Singular consumers reject statically known zero/multiple groups here.
 * Wildcard and variable cardinality remains evaluator-validated because only
 * evaluation has their concrete values.
 */
export function validateSelectorConsumer(
  ref: RepeatableFaceRef,
  consumer: SelectorConsumer,
  scope: Scope,
  state: State,
  fallbackSpan: ASTSourceSpan,
): void {
  const concrete = expandRepeatableFaceRef(ref);
  validateKnownCardinality(ref, concrete, consumer, scope, state);
  for (const target of concrete) {
    const kind = classifyConcreteFaceRefSelector(target, scope, state);
    const diagnostic = selectorConsumerDiagnostic(kind, consumer);
    if (diagnostic)
      addError(state, diagnostic, selectorSpan(target, fallbackSpan));
  }
}

/** Validates a non-list face reference using the same compatibility rules. */
export function validateSingleFaceRefConsumer(
  ref: FaceRef,
  consumer: SelectorConsumer,
  scope: Scope,
  state: State,
  fallbackSpan: ASTSourceSpan,
): void {
  validateSelectorConsumer(ref, consumer, scope, state, fallbackSpan);
}

/**
 * Validates known cardinality and reports any violations.
 */
function validateKnownCardinality(
  ref: RepeatableFaceRef,
  concrete: FaceRef[],
  consumer: SelectorConsumer,
  scope: Scope,
  state: State,
): void {
  const envelope =
    ref.kind === 'faceRefList'
      ? 'expanded-selection'
      : classifyFaceRefSelector(ref, scope, state);
  if (
    selectorConsumerCompatibility(envelope, consumer) !==
      'validate-one-expanded-member' ||
    hasRuntimeExpansion(ref, scope)
  ) {
    return;
  }
  if (concrete.length !== 1) {
    addError(
      state,
      `${consumer} requires exactly one selector target; received ${concrete.length}`,
      ref.span,
    );
  }
}

/**
 * Checks whether the input has runtime expansion.
 */
function hasRuntimeExpansion(ref: RepeatableFaceRef, scope: Scope): boolean {
  const refs = ref.kind === 'faceRefList' ? ref.items : [ref];
  return refs.some((item) =>
    item.chain.some(
      (segment) =>
        segment.kind === 'wildcard' ||
        (segment.kind === 'name' && scope.lookup(segment.value) === 'var'),
    ),
  );
}

/**
 * Handles selector span in the references flow.
 */
function selectorSpan(ref: FaceRef, fallback: ASTSourceSpan): ASTSourceSpan {
  return ref.chain.at(-1)?.span ?? ref.span ?? fallback;
}
