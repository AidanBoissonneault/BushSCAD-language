/**
 * @author Aidan Boissonneault
 * @file eval-auto-types.ts
 * @purpose Evaluates auto types for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';

/**
 * Axis accepts 'x', 'y', and null.
 */
export type Axis = 'x' | 'y' | null;

/**
 * Fixed term, including expr and sign.
 */
export interface FixedTerm {
  expr: Expr;
  sign: number;
}
