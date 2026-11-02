/**
 * @author Aidan Boissonneault
 * @file parse-path-points.ts
 * @purpose Parses path points for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { Token } from '../core/token-types.js';

/**
 * Parsed line points is tagged by kind: 'explicit' carries start, end, 'inferred' carries end,
 * and 'invalid'.
 */
type ParsedLinePoints =
  | { kind: 'explicit'; start: [Expr, Expr]; end: [Expr, Expr] }
  | { kind: 'inferred'; end: [Expr, Expr] }
  | { kind: 'invalid' };

/**
 * Normalizes path-local line arguments into explicit or cursor-inferred points.
 * `line(...)` accepts one endpoint as either `x, y` or `(x, y)`, but explicit
 * two-point lines must use tuple point syntax to avoid ambiguous coordinate
 * lists.
 */
export function parseLinePoints(args: Expr[]): ParsedLinePoints {
  if (args.length === 1 && isPointExpr(args[0])) {
    return { kind: 'inferred', end: pointFromExpr(args[0]) };
  }
  if (args.length === 2 && isPointExpr(args[0]) && isPointExpr(args[1])) {
    return {
      kind: 'explicit',
      start: pointFromExpr(args[0]),
      end: pointFromExpr(args[1]),
    };
  }
  if (args.length === 2 && !args.some(isPointExpr)) {
    return { kind: 'inferred', end: [args[0], args[1]] };
  }
  return { kind: 'invalid' };
}

/**
 * Creates line geometry from the supplied endpoints.
 */
export function linePointError(args: Expr[]): string {
  if (args.length === 4) {
    return 'line() with two points must use point tuples: line((x1, y1), (x2, y2)). Use line(x, y) or line((x, y)) for one cursor endpoint.';
  }
  return 'line() in path() expects line((x1, y1), (x2, y2)), line(x, y), or line((x, y)).';
}

/**
 * Arc arg is tagged by kind: 'expr' carries expr and 'direction' carries direction, span.
 */
type ArcArg =
  | { kind: 'expr'; expr: Expr }
  | { kind: 'direction'; direction: 'cw' | 'ccw'; span: Token['span'] };

/**
 * Normalized arc args, including start, end, radius, and direction.
 */
type NormalizedArcArgs = {
  start?: [Expr, Expr];
  end: [Expr, Expr];
  radius: Expr;
  direction: 'cw' | 'ccw';
};

/**
 * Parses path-local arc arguments while preserving bare direction words.
 * `cw` and `ccw` are contextual arc directions, not variables, and `radius:`
 * is accepted as a keyword form for the radius expression.
 */
export function parseArcArgs(p: Parser): ArcArg[] {
  const args: ArcArg[] = [];
  while (!p.check('RPAREN', 'EOF')) {
    if (isAnyDirectionToken(p.peek())) {
      const token = p.advance();
      args.push({
        kind: 'direction',
        direction: isDirectionToken(token, 'cw') ? 'cw' : 'ccw',
        span: token.span,
      });
    } else {
      args.push({ kind: 'expr', expr: parseArcRadiusExpr(p) });
    }
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Parses arc radius expr from the supplied source into the paths representation.
 */
function parseArcRadiusExpr(p: Parser): Expr {
  if (p.peek().value === 'radius' && p.peek(1).kind === 'COLON') {
    p.advance();
    p.advance();
    return p.parseExpr();
  }
  return p.parseExpr();
}

/**
 * Normalizes arc args into the canonical form.
 */
export function normalizeArcArgs(args: ArcArg[]): NormalizedArcArgs | null {
  const direction = arcDirection(args);
  const exprs = arcExprs(args);
  if (!direction) return null;
  return (
    bareEndpointArc(exprs, direction) ??
    tupleEndpointArc(exprs, direction) ??
    explicitTupleArc(exprs, direction)
  );
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcDirection(args: ArcArg[]): 'cw' | 'ccw' | undefined {
  return args.find(
    (arg): arg is Extract<ArcArg, { kind: 'direction' }> =>
      arg.kind === 'direction',
  )?.direction;
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcExprs(args: ArcArg[]): Expr[] {
  return args
    .filter(
      (arg): arg is Extract<ArcArg, { kind: 'expr' }> => arg.kind === 'expr',
    )
    .map((arg) => arg.expr);
}

/**
 * Handles bare endpoint arc in the paths flow.
 */
function bareEndpointArc(
  exprs: Expr[],
  direction: 'cw' | 'ccw',
): NormalizedArcArgs | null {
  if (exprs.length === 3 && !exprs.slice(0, 2).some(isPointExpr)) {
    return { end: [exprs[0], exprs[1]], radius: exprs[2], direction };
  }
  return null;
}

/**
 * Handles tuple endpoint arc in the paths flow.
 */
function tupleEndpointArc(
  exprs: Expr[],
  direction: 'cw' | 'ccw',
): NormalizedArcArgs | null {
  if (exprs.length === 2 && isPointExpr(exprs[0])) {
    return { end: pointFromExpr(exprs[0]), radius: exprs[1], direction };
  }
  return null;
}

/**
 * Handles explicit tuple arc in the paths flow.
 */
function explicitTupleArc(
  exprs: Expr[],
  direction: 'cw' | 'ccw',
): NormalizedArcArgs | null {
  if (exprs.length === 3 && isPointExpr(exprs[0]) && isPointExpr(exprs[1])) {
    return {
      start: pointFromExpr(exprs[0]),
      end: pointFromExpr(exprs[1]),
      radius: exprs[2],
      direction,
    };
  }
  return null;
}

/**
 * Returns whether the input meets the `direction token` condition.
 */
function isDirectionToken(token: Token, direction: 'cw' | 'ccw'): boolean {
  if (token.kind === 'IDENT') return token.value === direction;
  if (direction === 'cw') return token.kind === 'CLOCKWISE';
  return token.kind === 'COUNTERCLOCKWISE';
}

/**
 * Returns whether the input meets the `any direction token` condition.
 */
function isAnyDirectionToken(token: Token): boolean {
  return isDirectionToken(token, 'cw') || isDirectionToken(token, 'ccw');
}

/**
 * Returns whether the input meets the `point expr` condition.
 */
function isPointExpr(expr: Expr): expr is Extract<Expr, { kind: 'tuple' }> {
  return expr.kind === 'tuple';
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointFromExpr(expr: Extract<Expr, { kind: 'tuple' }>): [Expr, Expr] {
  return [expr.x, expr.y];
}
