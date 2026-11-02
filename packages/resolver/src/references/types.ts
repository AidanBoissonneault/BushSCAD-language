/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the references in resolver package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';

/**
 * Defines the `ResolveExprFn` callback contract used by the references layer.
 */
export type ResolveExprFn = (expr: Expr, scope: Scope, state: State) => void;
