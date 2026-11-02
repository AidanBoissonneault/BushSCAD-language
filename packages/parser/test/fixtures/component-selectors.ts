/**
 * @author Aidan Boissonneault
 * @file component-selectors.ts
 * @purpose Tests component selectors behavior in the fixtures in parser package.
 * @last-edited October 6, 2026
 */

import type { PartDecl, Program } from '@bushscad/ir';
import { part } from './part-selectors.js';

/** Returns a named component declaration from a parsed program. */
export function component(ast: Program, name: string): PartDecl {
  return part(ast, name);
}
