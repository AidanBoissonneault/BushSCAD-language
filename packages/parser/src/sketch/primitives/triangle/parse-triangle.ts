import type { TrianglePrimitive } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import { parseOrderedExprArgs } from '../../../expressions/parse-ordered-args.js';
import { parseOriginExpr, SKETCH_ORIGINS } from '../../parse-sketch-origin.js';
import { parseTrailingSketchPlacement } from '../../placement/parse-trailing-sketch-placement.js';

/**
 * Parses triangle from the supplied source into the sketch representation.
 */
export function parseTriangle(p: Parser): TrianglePrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'triangle', [
    { name: 'base', required: true },
    { name: 'height', required: true },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
  ]);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  return {
    kind: 'triangle',
    base: args.base!,
    height: args.height!,
    origin: parseOriginExpr(p, 'triangle', args.origin),
    placement,
    span: p.spanFrom(start),
  };
}
