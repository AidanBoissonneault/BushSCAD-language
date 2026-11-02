/**
 * @author Aidan Boissonneault
 * @file eval-body-object-names.ts
 * @purpose Evaluates body object names for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ComponentBody } from '@bushscad/ir';
import { collectBodyNames } from './eval-body-name-walk.js';

/**
 * Collects only object names declared in a body for anchor resolution.
 * Anchor resolution only needs concrete object-producing declarations, not
 * sketch, path, or surface names used by loop suffixing.
 */
export function collectBodyObjectNames(body: ComponentBody): string[] {
  return collectBodyNames(
    body,
    (kind) => kind === 'obj' || kind === 'objCall' || kind === 'refObj',
  );
}
