/**
 * @author Aidan Boissonneault
 * @file parse-sketch-polygon.ts
 * @purpose Parses sketch polygon for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  PolygonPrimitive,
  SketchOrigin,
  SketchPlacement,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  isBareOriginToken,
  parseBareOrigin,
  parseOriginExpr,
} from './parse-sketch-origin.js';

/**
 * Parses the polygon sketch primitive.
 * Polygon has custom point-list syntax plus legacy placement/origin/plant
 * options, so keeping it separate keeps the primitive dispatcher small.
 */
export function parsePolygon(p: Parser): PolygonPrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  p.expect('LBRACKET');
  const points: [Expr, Expr][] = [];
  while (!p.check('RBRACKET', 'EOF')) {
    p.expect('LPAREN');
    const x = p.parseExpr();
    p.expect('COMMA');
    const y = p.parseExpr();
    p.expect('RPAREN');
    points.push([x, y]);
    p.eat('COMMA');
  }
  p.expect('RBRACKET');
  let plant = Boolean(p.eat('PLANT'));
  let origin: SketchOrigin | undefined;
  let placement: SketchPlacement | undefined;
  while (p.eat('COMMA')) {
    const parsed = parsePolygonTrailingArg(p);
    if (parsed.kind === 'placement') placement = parsed.placement;
    else if (parsed.kind === 'origin') origin = parsed.origin;
    else if (parsed.kind === 'plant') plant = true;
  }
  p.expect('RPAREN');
  return {
    kind: 'polygon',
    points,
    plant,
    origin,
    placement,
    span: p.spanFrom(start),
  };
}

/**
 * Polygon trailing arg is tagged by kind: 'placement' carries placement, 'origin' carries
 * origin, 'plant', and 'ignored'.
 */
type PolygonTrailingArg =
  | { kind: 'placement'; placement: SketchPlacement }
  | { kind: 'origin'; origin: SketchOrigin }
  | { kind: 'plant' }
  | { kind: 'ignored' };

/**
 * Parses polygon trailing arg from the supplied source into the sketch representation.
 */
function parsePolygonTrailingArg(p: Parser): PolygonTrailingArg {
  if (p.check('AT_SIGN')) {
    return {
      kind: 'placement',
      placement: { mode: 'on', face: p.parseSpatialRef() },
    };
  }
  if (isBareOriginToken(p))
    return { kind: 'origin', origin: parseBareOrigin(p) };
  const arg = p.parseNamedExprArg();
  if (arg) {
    const [argName, val] = arg;
    if (argName === 'origin') {
      const origin = parseOriginExpr(p, 'polygon', val);
      return origin ? { kind: 'origin', origin } : { kind: 'ignored' };
    }
    p.addError(`polygon() does not accept argument '${argName}'`, val.span);
    return { kind: 'ignored' };
  }
  if (p.eat('PLANT')) return { kind: 'plant' };
  p.parseExpr();
  return { kind: 'ignored' };
}
