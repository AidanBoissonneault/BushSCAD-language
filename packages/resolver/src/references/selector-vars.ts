/**
 * @author Aidan Boissonneault
 * @file selector-vars.ts
 * @purpose Provides selector vars behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import { FACE_WORDS } from './refs.js';

/**
 * Detects var/function values intended for reference selector expansion.
 * `var sides = [top, bottom]` stores selector names, not ordinary variable
 * reads. Resolver should not report undefined-variable errors for those words.
 */
export function isSelectorNameValue(expr: Expr): boolean {
  if (expr.kind === 'identifier') return FACE_WORDS.has(expr.name);
  if (expr.kind !== 'list' || expr.items.length === 0) return false;
  return expr.items.every(
    (item) =>
      item.kind === 'string' ||
      (item.kind === 'identifier' && FACE_WORDS.has(item.name)),
  );
}
