/**
 * @author Aidan Boissonneault
 * @file sketch-expression-parser.ts
 * @purpose Provides sketch expression parser behavior for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Parses one complete sketch expression from the current token.
 * Recursive sketch containers receive this callback instead of importing the
 * expression module, keeping the parser dependency graph acyclic.
 */
export type SketchExpressionParser = (parser: Parser) => SketchPrimitive;
