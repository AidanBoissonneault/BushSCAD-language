/**
 * @author Aidan Boissonneault
 * @file eval-body-anchors.ts
 * @purpose Evaluates body anchors for the statements in evaluator package.
 * @last-edited October 6, 2026
 */

import type { AnchorDecl, ComponentBody } from '@bushscad/ir';

/**
 * Collects named anchors declared directly in a component body.
 * Placement evaluation needs quick anchor lookup for one body scope, while
 * nested body traversal is owned by the statement evaluators themselves.
 */
export function collectAnchors(body: ComponentBody): Map<string, AnchorDecl> {
  const anchors = new Map<string, AnchorDecl>();
  for (const stmt of body.statements) {
    if (stmt.kind === 'anchor') anchors.set(stmt.name ?? 'default', stmt);
  }
  return anchors;
}
