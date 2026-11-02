/**
 * @author Aidan Boissonneault
 * @file selector-aliases.ts
 * @purpose Provides selector aliases behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { RepeatableSpatialRef } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { classifyFaceRefSelector } from './selector-classification.js';

/**
 * Records the topology represented by a named anchor for later consumers.
 * Anchors may alias an edge, corner, face, or computed position. Treating all
 * single-name anchors as points makes valid edge aliases fail modifier checks.
 */
export function recordSelectorAlias(
  name: string,
  point: RepeatableSpatialRef,
  scope: Scope,
  state: State,
): void {
  if (point.kind === 'faceRef') {
    state.selectorAliases.set(
      name,
      classifyFaceRefSelector(point, scope, state),
    );
    return;
  }
  if (point.kind === 'faceRefList') {
    state.selectorAliases.set(name, 'expanded-selection');
    return;
  }
  state.selectorAliases.set(name, 'face-point');
}
