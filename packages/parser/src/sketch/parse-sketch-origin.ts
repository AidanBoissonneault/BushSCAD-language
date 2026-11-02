/**
 * @author Aidan Boissonneault
 * @file parse-sketch-origin.ts
 * @purpose Parses sketch origin for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr, SketchOrigin } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

export const SKETCH_ORIGINS = ['center', 'corner'] as const;

/**
 * Parses origin expr from the supplied source into the sketch representation.
 */
export function parseOriginExpr(
  p: Parser,
  callName: string,
  expr: Expr | undefined,
): SketchOrigin | undefined {
  if (!expr) return undefined;
  const value =
    expr.kind === 'identifier'
      ? expr.name
      : expr.kind === 'string'
        ? expr.value
        : '';
  if (value === 'center' || value === 'corner') return value;
  p.addError(`${callName}() origin must be center or corner`, expr.span);
  return undefined;
}

/**
 * Returns whether the input meets the `bare origin token` condition.
 */
export function isBareOriginToken(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    (p.peek().value === 'center' || p.peek().value === 'corner')
  );
}

/**
 * Parses bare origin from the supplied source into the sketch representation.
 */
export function parseBareOrigin(p: Parser): SketchOrigin {
  return p.advance().value as SketchOrigin;
}
