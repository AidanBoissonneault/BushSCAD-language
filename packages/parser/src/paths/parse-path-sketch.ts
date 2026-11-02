/**
 * @author Aidan Boissonneault
 * @file parse-path-sketch.ts
 * @purpose Parses path sketch for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ConstraintDecl,
  Expr,
  PathBodyExpressionDecl,
  PathClosedBodyDecl,
  PathIgnoredBodyExpressionDecl,
  PathIgnoredClosedBodyDecl,
  PathItem,
  PathSketchPrimitive,
  SketchDimensionDecl,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { SketchExpressionParser } from '../sketch/sketch-expression-parser.js';
import { parsePointTuple2 } from '../sketch/parse-sketch-points.js';
import { parseSketchConstraintOrDimension } from '../sketch/parse-sketch-annotations.js';
import {
  parseClosedBodyDecl,
  parseIgnoredClosedBodyDecl,
} from './parse-path-closed-bodies.js';
import { parsePathItem } from './parse-path-segments.js';
import {
  parsePathBodyExpressionDecl,
  parsePathIgnoredBodyExpressionDecl,
} from './parse-path-body-expressions.js';
import {
  isPathPrimitiveStart,
  parsePathPrimitiveItem,
} from './parse-path-primitives.js';

/**
 * Parses the function-style `path(...)` sketch constructor.
 * Path items are contextual declarations inside a call argument list. Handling
 * them here avoids treating `plant foot = line(...)` as a general assignment.
 */
export function parsePathSketch(
  p: Parser,
  parseExpression: SketchExpressionParser,
): PathSketchPrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const items: PathItem[] = [];
  const closedBodies: PathClosedBodyDecl[] = [];
  const ignoredClosedBodies: PathIgnoredClosedBodyDecl[] = [];
  const bodyExpressions: PathBodyExpressionDecl[] = [];
  const ignoredBodyExpressions: PathIgnoredBodyExpressionDecl[] = [];
  const constraints: ConstraintDecl[] = [];
  const dimensions: SketchDimensionDecl[] = [];
  let placementOrigin: [Expr, Expr] | undefined;
  while (!p.check('RPAREN', 'EOF')) {
    const origin = parsePathOrigin(p);
    if (origin) {
      if (placementOrigin)
        p.addError(
          'path() accepts only one origin((x, y)) item.',
          origin[0].span,
        );
      placementOrigin = origin;
    } else if (parseClosedBodyDecl(p, closedBodies)) {
      // parsed declaration
    } else if (parseIgnoredClosedBodyDecl(p, ignoredClosedBodies)) {
      // parsed declaration
    } else if (parsePathBodyExpressionDecl(p, bodyExpressions)) {
      // parsed declaration
    } else if (parsePathIgnoredBodyExpressionDecl(p, ignoredBodyExpressions)) {
      // parsed declaration
    } else if (isPathPrimitiveStart(p)) {
      items.push(parsePathPrimitiveItem(p, parseExpression));
    } else if (!parseSketchConstraintOrDimension(p, constraints, dimensions)) {
      items.push(...parsePathItem(p));
    }
    if (!p.eat('COMMA')) break;
  }
  p.expect('RPAREN');
  return {
    kind: 'pathSketch',
    placementOrigin,
    items,
    closedBodies,
    ignoredClosedBodies,
    bodyExpressions,
    ignoredBodyExpressions,
    constraints,
    dimensions,
    span: p.spanFrom(start),
  };
}

/**
 * Parses path origin from the supplied source into the paths representation.
 */
function parsePathOrigin(p: Parser): [Expr, Expr] | null {
  if (
    p.peek().kind !== 'IDENT' ||
    p.peek().value !== 'origin' ||
    p.peek(1).kind !== 'LPAREN'
  ) {
    return null;
  }
  p.advance();
  p.expect('LPAREN');
  const point = parsePointTuple2(p);
  p.expect('RPAREN');
  return point;
}
