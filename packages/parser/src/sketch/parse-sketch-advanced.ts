/**
 * @author Aidan Boissonneault
 * @file parse-sketch-advanced.ts
 * @purpose Parses sketch advanced for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  SketchPrimitive,
  UnsupportedSketchPrimitive,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { markCompactDimensionPlaceholders } from './parse-compact-sketch-dimensions.js';

/**
 * Defines the `SketchExpressionParser` callback contract used by the sketch layer.
 */
type SketchExpressionParser = (p: Parser) => SketchPrimitive;

const IDENT_CALLS = new Set([
  'construction',
  'ellipse',
  'spline',
  'project',
  'trim',
  'extend',
]);

/**
 * Returns whether the input meets the `advanced sketch call` condition.
 */
export function isAdvancedSketchCall(p: Parser): boolean {
  if (p.peek(1).kind !== 'LPAREN') return false;
  if (p.peek().kind === 'FILLET' || p.peek().kind === 'OFFSET') return true;
  return p.peek().kind === 'IDENT' && IDENT_CALLS.has(p.peek().value);
}

/**
 * Parses newer sketch operations that are expressed as sketch-level calls.
 * These names overlap ordinary identifiers or existing body-level keywords, so
 * they are recognized only when immediately followed by a call in sketch syntax.
 */
export function parseAdvancedSketchCall(
  p: Parser,
  parseSketchExpression: SketchExpressionParser,
): SketchPrimitive {
  const token = p.advance();
  const start = token.span;
  const operation =
    token.kind === 'IDENT' ? token.value : token.kind.toLowerCase();
  if (operation === 'ellipse') return parseEllipseCall(p, start);
  if (operation === 'spline') return parseSplineCall(p, start);
  if (operation === 'construction') {
    p.expect('LPAREN');
    const primitive = parseSketchExpression(p);
    p.expect('RPAREN');
    return { kind: 'sketchConstruction', primitive, span: p.spanFrom(start) };
  }
  if (operation === 'offset') {
    p.expect('LPAREN');
    const primitive = parseSketchExpression(p);
    p.expect('COMMA');
    const distance = p.parseExpr();
    p.expect('RPAREN');
    return {
      kind: 'sketchOffset',
      primitive,
      distance,
      span: p.spanFrom(start),
    };
  }
  if (operation === 'fillet') {
    p.expect('LPAREN');
    const primitive = parseSketchExpression(p);
    p.expect('COMMA');
    const radius = p.parseExpr();
    p.expect('RPAREN');
    return { kind: 'sketchFillet', primitive, radius, span: p.spanFrom(start) };
  }
  return parseUnsupportedCall(p, operation, start);
}

/**
 * Parses ellipse call from the supplied source into the sketch representation.
 */
function parseEllipseCall(
  p: Parser,
  start: import('@bushscad/ir').ASTSourceSpan,
): SketchPrimitive {
  p.expect('LPAREN');
  const width = p.parseExpr();
  p.expect('COMMA');
  const height = p.parseExpr();
  p.expect('RPAREN');
  const primitive: Extract<SketchPrimitive, { kind: 'ellipse' }> = {
    kind: 'ellipse',
    width,
    height,
    span: p.spanFrom(start),
  };
  markCompactDimensionPlaceholders(primitive, { width, height });
  return primitive;
}

/**
 * Parses spline call from the supplied source into the sketch representation.
 */
function parseSplineCall(
  p: Parser,
  start: import('@bushscad/ir').ASTSourceSpan,
): SketchPrimitive {
  p.expect('LPAREN');
  const points = exprToPointList(p.parseExpr());
  p.expect('RPAREN');
  return { kind: 'splineSketch', points, span: p.spanFrom(start) };
}

/**
 * Handles expr to point list in the sketch flow.
 */
function exprToPointList(expr: Expr): [Expr, Expr][] {
  if (expr.kind !== 'list') return [];
  return expr.items
    .filter((item) => item.kind === 'tuple')
    .map((item) => [item.x, item.y] as [Expr, Expr]);
}

/**
 * Parses unsupported call from the supplied source into the sketch representation.
 */
function parseUnsupportedCall(
  p: Parser,
  operation: string,
  start: import('@bushscad/ir').ASTSourceSpan,
): UnsupportedSketchPrimitive {
  p.expect('LPAREN');
  let depth = 1;
  while (depth > 0 && !p.check('EOF')) {
    if (p.eat('LPAREN')) depth++;
    else if (p.eat('RPAREN')) depth--;
    else p.advance();
  }
  const op = operation as UnsupportedSketchPrimitive['operation'];
  return { kind: 'unsupportedSketch', operation: op, span: p.spanFrom(start) };
}
