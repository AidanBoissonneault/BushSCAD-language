/**
 * @author Aidan Boissonneault
 * @file eval-body-local-names.ts
 * @purpose Evaluates body local names for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ComponentBody } from '@bushscad/ir';
import type { BodyNameFacts } from '../core/eval-types.js';
import { analyzeBodyNames } from './eval-body-name-walk.js';

/**
 * Collects all sketch/object-style names declared in a body for loop renaming.
 * Generated loop placements need deterministic suffixing for every named body
 * declaration that can appear inside nested control-flow statements.
 */
export function collectBodyLocalNames(
  body: ComponentBody,
  cache: WeakMap<ComponentBody, BodyNameFacts>,
): readonly string[] {
  return analyzeBodyNames(body, cache).localNames;
}
