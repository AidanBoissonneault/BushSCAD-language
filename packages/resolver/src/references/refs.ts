/**
 * @author Aidan Boissonneault
 * @file refs.ts
 * @purpose Provides refs behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, PosRef, RepeatableSpatialRef } from '@bushscad/ir';
import { expandRepeatableSpatialRef } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveFaceRef } from './face-refs.js';
import type { ResolveExprFn } from './types.js';
import type { SelectorConsumer } from './selector-compatibility.js';

export {
  FACE_WORDS,
  resolveFaceRef,
  resolveRepeatableFaceRef,
} from './face-refs.js';
export {
  SELECTOR_CONSUMER_COMPATIBILITY,
  SELECTOR_CONSUMERS,
  SELECTOR_KINDS,
  selectorConsumerCompatibility,
  selectorConsumerDiagnostic,
} from './selector-compatibility.js';
export type {
  SelectorConsumer,
  SelectorConsumerCompatibilityTable,
  SelectorConsumption,
  SelectorKind,
} from './selector-compatibility.js';

/**
 * Resolves a position reference, including anchor and offset expressions.
 */
export function resolvePosRef(
  ref: PosRef,
  scope: Scope,
  state: State,
  resolveExpr: ResolveExprFn,
  consumer: SelectorConsumer = 'placement',
): void {
  if (Array.isArray(ref.anchor)) {
    for (const expr of ref.anchor) resolveExpr(expr, scope, state);
  } else {
    resolveFaceRef(ref.anchor, scope, state, ref.span, resolveExpr, consumer);
  }
  if (ref.x) resolveExpr(ref.x, scope, state);
  if (ref.y) resolveExpr(ref.y, scope, state);
  if (ref.radius) resolveExpr(ref.radius, scope, state);
  if (ref.angle) resolveExpr(ref.angle, scope, state);
  if (ref.offset) resolveExpr(ref.offset, scope, state);
}

/**
 * Resolves a placement reference regardless of whether it is face or position based.
 */
export function resolveFromRef(
  ref: RepeatableSpatialRef,
  scope: Scope,
  state: State,
  span: ASTSourceSpan,
  resolveExpr: ResolveExprFn,
  consumer: SelectorConsumer = 'placement',
): void {
  for (const concrete of expandRepeatableSpatialRef(ref)) {
    if (concrete.kind === 'faceRef') {
      resolveFaceRef(concrete, scope, state, span, resolveExpr, consumer);
    } else {
      resolvePosRef(concrete, scope, state, resolveExpr, consumer);
    }
  }
}
