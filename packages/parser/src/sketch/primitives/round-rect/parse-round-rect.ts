import type { RoundRectPrimitive } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import { parseOrderedExprArgs } from '../../../expressions/parse-ordered-args.js';
import { parseOriginExpr, SKETCH_ORIGINS } from '../../parse-sketch-origin.js';
import { markCompactDimensionPlaceholders } from '../../parse-compact-sketch-dimensions.js';
import { parseTrailingSketchPlacement } from '../../placement/parse-trailing-sketch-placement.js';

/**
 * Parses round rect from the supplied source into the sketch representation.
 */
export function parseRoundRect(p: Parser): RoundRectPrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'roundrect', [
    { name: 'width', required: true },
    { name: 'height', required: true },
    { name: 'radius', aliases: ['r'], required: true },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
  ]);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  const primitive: RoundRectPrimitive = {
    kind: 'roundrect',
    width: args.width!,
    height: args.height!,
    radius: args.radius!,
    origin: parseOriginExpr(p, 'roundrect', args.origin),
    placement,
    span: p.spanFrom(start),
  };
  markCompactDimensionPlaceholders(primitive, {
    width: primitive.width,
    height: primitive.height,
    radius: primitive.radius,
  });
  return primitive;
}
