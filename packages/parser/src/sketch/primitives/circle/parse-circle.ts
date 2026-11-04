import type { CirclePrimitive } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import { parseOrderedExprArgs } from '../../../expressions/parse-ordered-args.js';
import { parseOriginExpr, SKETCH_ORIGINS } from '../../parse-sketch-origin.js';
import { markCompactDimensionPlaceholders } from '../../parse-compact-sketch-dimensions.js';
import { parseTrailingSketchPlacement } from '../../placement/parse-trailing-sketch-placement.js';

/**
 * Parses circle from the supplied source into the sketch representation.
 */
export function parseCircle(p: Parser): CirclePrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'circle', [
    { name: 'diameter', aliases: ['d'], required: true },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
  ]);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  const primitive: CirclePrimitive = {
    kind: 'circle',
    diameter: args.diameter!,
    origin: parseOriginExpr(p, 'circle', args.origin),
    placement,
    span: p.spanFrom(start),
  };
  markCompactDimensionPlaceholders(primitive, {
    diameter: primitive.diameter,
  });
  return primitive;
}
