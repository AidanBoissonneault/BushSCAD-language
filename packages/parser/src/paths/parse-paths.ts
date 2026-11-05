/**
 * @author Aidan Boissonneault
 * @file parse-paths.ts
 * @purpose Parses paths for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type { PathDecl, PathPrimitive, Point3D } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { expectName } from '../expressions/parse-names.js';

/**
 * Parses path from the supplied source into the paths representation.
 */
export function parsePath(p: Parser): PathDecl {
  const start = p.peek().span;
  p.advance(); // PATH
  const name = expectName(p).value;
  p.expect('ASSIGN');
  const primitive = parsePathPrimitive(p);
  p.requireSemi();
  return { kind: 'path', name, primitive, span: p.spanFrom(start) };
}

/**
 * Parses path primitive from the supplied source into the paths representation.
 */
export function parsePathPrimitive(p: Parser): PathPrimitive {
  const start = p.peek().span;
  const tok = p.advance();
  if (tok.value !== 'polyline' && tok.value !== 'spline') {
    p.fail(`Expected polyline or spline, got '${tok.value}'`, tok.span);
  }
  const kind = tok.value as 'polyline' | 'spline';
  p.expect('LPAREN');
  const points = parsePoint3DList(p);
  p.expect('RPAREN');
  return { kind, points, span: p.spanFrom(start) };
}

/**
 * Parses point3 d list from the supplied source into the paths representation.
 */
function parsePoint3DList(p: Parser): Point3D[] {
  p.expect('LBRACKET');
  const points: Point3D[] = [];
  while (!p.check('RBRACKET', 'EOF')) {
    points.push(parsePoint3D(p));
    p.eat('COMMA');
  }
  p.expect('RBRACKET');
  return points;
}

/**
 * Parses point3 d from the supplied source into the paths representation.
 */
function parsePoint3D(p: Parser): Point3D {
  p.expect('LPAREN');
  const x = p.parseExpr();
  p.expect('COMMA');
  const y = p.parseExpr();
  p.expect('COMMA');
  const z = p.parseExpr();
  p.expect('RPAREN');
  return { x, y, z };
}
