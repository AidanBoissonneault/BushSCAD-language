/**
 * @author Aidan Boissonneault
 * @file eval-auto-fixed-terms.ts
 * @purpose Evaluates auto fixed terms for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { AutoExpr, Expr } from '@bushscad/ir';
import {
  autoNodesIn,
  exprChildren,
  exprContainsAuto,
} from './eval-auto-expression-walk.js';
import type { FixedTerm } from './eval-auto-types.js';

/**
 * Attributes non-`auto` `+`/`-` terms to adjacent `auto` nodes.
 *
 * Parent-face auto sizing and `within` distribution both subtract fixed inline
 * offsets before dividing remaining space.
 */
function attributeFixed(e: Expr, fixedOf: Map<AutoExpr, FixedTerm[]>): void {
  const term = fixedTermForBinary(e);
  if (term) {
    for (const node of term.nodes) pushFixed(fixedOf, node, term.fixed);
  }
  for (const child of exprChildren(e)) attributeFixed(child, fixedOf);
}

/**
 * Returns unique fixed terms for one expression.
 *
 * A fixed term can be associated with more than one `auto`; callers that need
 * a total evaluate each distinct term only once.
 */
export function uniqueFixedTerms(e: Expr): FixedTerm[] {
  const map = new Map<AutoExpr, FixedTerm[]>();
  attributeFixed(e, map);
  const seen = new Set<FixedTerm>();
  const terms: FixedTerm[] = [];
  for (const fixedTerms of map.values()) {
    for (const term of fixedTerms) {
      if (seen.has(term)) continue;
      seen.add(term);
      terms.push(term);
    }
  }
  return terms;
}

/**
 * Returns each `auto` node in an expression with its attributed fixed terms.
 *
 * Used by `within` collection to keep node discovery and fixed-offset
 * attribution consistent with parent-face auto sizing.
 */
export function autoFixedTermsIn(
  e: Expr,
): { node: AutoExpr; fixed: FixedTerm[] }[] {
  const nodes = autoNodesIn(e);
  if (nodes.length === 0) return [];

  const fixedOf = new Map<AutoExpr, FixedTerm[]>();
  attributeFixed(e, fixedOf);
  return nodes.map((node) => ({ node, fixed: fixedOf.get(node) ?? [] }));
}

/**
 * Handles fixed term for binary in the core flow.
 */
function fixedTermForBinary(
  e: Expr,
): { nodes: AutoExpr[]; fixed: FixedTerm } | null {
  if (e.kind !== 'binary' || (e.op !== '+' && e.op !== '-')) return null;
  const side = fixedBinaryTermSide(e);
  if (!side) return null;
  return {
    nodes: autoNodesIn(side.auto),
    fixed: { expr: side.fixed, sign: side.sign },
  };
}

/**
 * Handles fixed binary term side in the core flow.
 */
function fixedBinaryTermSide(
  e: Extract<Expr, { kind: 'binary' }>,
): { auto: Expr; fixed: Expr; sign: 1 | -1 } | null {
  const leftHasAuto = exprContainsAuto(e.left);
  const rightHasAuto = exprContainsAuto(e.right);
  if (leftHasAuto && !rightHasAuto) {
    return {
      auto: e.left,
      fixed: e.right,
      sign: e.op === '+' ? 1 : -1,
    };
  }
  if (rightHasAuto && !leftHasAuto && e.op === '+') {
    return { auto: e.right, fixed: e.left, sign: 1 };
  }
  return null;
}

/**
 * Handles push fixed in the core flow.
 */
function pushFixed(
  map: Map<AutoExpr, FixedTerm[]>,
  node: AutoExpr,
  term: FixedTerm,
): void {
  const list = map.get(node);
  if (list) list.push(term);
  else map.set(node, [term]);
}
