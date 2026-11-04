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

/** One positional or named arc value, or a contextual direction word. */
type ArcArg =
  | { kind: 'expr'; expr: Expr; name?: string }
  | { kind: 'direction'; direction: 'cw' | 'ccw'; span: Token['span'] };

/** Normalized endpoints and options used by the path segment AST. */
type NormalizedArcArgs = {
  start?: [Expr, Expr];
  end: [Expr, Expr];
  radius?: Expr;
  direction: 'cw' | 'ccw';
};

/**
 * Parses arc inputs while preserving positional values, optional labels, and
 * contextual direction words. Two endpoints are sufficient for a semicircle.
 */
export function parseArcArgs(p: Parser): ArcArg[] {
  const state: ArcArgParserState = {
    args: [],
    seenNames: new Set(),
    sawDirection: false,
  };
  while (!p.check('RPAREN', 'EOF')) {
    parseOneArcArgument(p, state);
    if (!p.eat('COMMA')) break;
  }
  return state.args;
}

/** Tracks canonical named slots while one arc call is parsed. */
type ArcArgParserState = {
  args: ArcArg[];
  seenNames: Set<string>;
  sawDirection: boolean;
};

/** Parses one arc value or contextual direction token. */
function parseOneArcArgument(p: Parser, state: ArcArgParserState): void {
  if (isAnyDirectionToken(p.peek())) {
    parseBareArcDirection(p, state);
    return;
  }
  const named = p.parseNamedExprArg();
  if (named) {
    parseNamedArcArgument(p, state, named[0], named[1]);
    return;
  }
  state.args.push({ kind: 'expr', expr: p.parseExpr() });
}

/** Adds a contextual cw/ccw value once. */
function parseBareArcDirection(p: Parser, state: ArcArgParserState): void {
  const token = p.advance();
  if (state.sawDirection) {
    p.addError("arc() got duplicate argument 'direction'", token.span);
    return;
  }
  state.args.push({
    kind: 'direction',
    direction: isDirectionToken(token, 'cw') ? 'cw' : 'ccw',
    span: token.span,
  });
  state.sawDirection = true;
}

/** Validates and records one labeled arc input. */
function parseNamedArcArgument(
  p: Parser,
  state: ArcArgParserState,
  name: string,
  expr: Expr,
): void {
  if (!isArcArgumentName(name)) {
    p.addError(`arc() does not accept argument '${name}'`, expr.span);
    return;
  }
  if (name === 'direction') {
    parseNamedArcDirection(p, state, name, expr);
    return;
  }
  const canonicalName = canonicalArcArgName(name);
  if (canonicalName && state.seenNames.has(canonicalName)) {
    p.addError(`arc() got duplicate argument '${canonicalName}'`, expr.span);
  } else if (canonicalName) {
    state.seenNames.add(canonicalName);
  }
  state.args.push({ kind: 'expr', name, expr });
}

/** Validates one labeled direction value and detects a repeated direction slot. */
function parseNamedArcDirection(
  p: Parser,
  state: ArcArgParserState,
  name: string,
  expr: Expr,
): void {
  if (state.sawDirection) {
    p.addError("arc() got duplicate argument 'direction'", expr.span);
  } else if (!directionExpr(expr)) {
    p.addError("arc() direction must be 'cw' or 'ccw'", expr.span);
  } else {
    state.args.push({ kind: 'expr', name, expr });
  }
  state.sawDirection = true;
}

/** Normalizes mixed positional and named arc values into endpoint slots. */
export function normalizeArcArgs(args: ArcArg[]): NormalizedArcArgs | null {
  const values = collectArcValues(args);
  const positionalValues = positionalPoints(values.positional, values.named);
  if (!positionalValues) return null;
  const start = tuplePoint(values.named.get('start')) ?? positionalValues.start;
  const end = tuplePoint(values.named.get('end')) ?? positionalValues.end;
  if (!end) return null;
  return {
    start,
    end,
    radius: values.named.get('radius') ?? positionalValues.radius,
    direction: values.direction,
  };
}

/** Separates named and positional arc values and resolves the direction option. */
function collectArcValues(args: ArcArg[]): {
  positional: Expr[];
  named: Map<string, Expr>;
  direction: 'cw' | 'ccw';
} {
  const positional: Expr[] = [];
  const named = new Map<string, Expr>();
  let direction: 'cw' | 'ccw' = 'ccw';
  for (const arg of args)
    collectOneArcValue(arg, positional, named, (value) => {
      direction = value;
    });
  return { positional, named, direction };
}

/** Adds a single parsed arc value to its normalized slot. */
function collectOneArcValue(
  arg: ArcArg,
  positional: Expr[],
  named: Map<string, Expr>,
  setDirection: (direction: 'cw' | 'ccw') => void,
): void {
  if (arg.kind === 'direction') {
    setDirection(arg.direction);
  } else if (arg.name === 'direction') {
    const direction = directionExpr(arg.expr);
    if (direction) setDirection(direction);
  } else if (arg.name) {
    const name = canonicalArcArgName(arg.name);
    if (name && !named.has(name)) named.set(name, arg.expr);
  } else {
    positional.push(arg.expr);
  }
}

type PositionalArcValues = {
  start?: [Expr, Expr];
  end?: [Expr, Expr];
  radius?: Expr;
};

/** Assigns positional points by tuple shape and keeps radius in the final slot. */
function positionalPoints(
  args: Expr[],
  named: Map<string, Expr>,
): PositionalArcValues | null {
  const tuples = args.filter(isPointExpr);
  const values = args.filter((expr) => !isPointExpr(expr));
  if (tuples.length > 2) return null;
  if (tuples.length === 2) return arcFromTwoPointTuples(tuples, values);
  if (tuples.length === 1)
    return arcFromOnePointTuple(tuples[0], values, named);
  return arcFromScalarValues(args.length, values);
}

/** Normalizes two tuple endpoints and an optional positional radius. */
function arcFromTwoPointTuples(
  tuples: Extract<Expr, { kind: 'tuple' }>[],
  values: Expr[],
): PositionalArcValues | null {
  if (values.length > 1) return null;
  return {
    start: pointFromExpr(tuples[0]),
    end: pointFromExpr(tuples[1]),
    radius: values[0],
  };
}

/** Normalizes one tuple endpoint with optional cursor or labeled endpoints. */
function arcFromOnePointTuple(
  tuple: Extract<Expr, { kind: 'tuple' }>,
  values: Expr[],
  named: Map<string, Expr>,
): PositionalArcValues | null {
  if (values.length > 1) return null;
  const point = pointFromExpr(tuple);
  if (named.has('start')) return { end: point, radius: values[0] };
  if (named.has('end')) return { start: point, radius: values[0] };
  return { end: point, radius: values[0] };
}

/** Normalizes scalar coordinates into one cursor endpoint or explicit point pair. */
function arcFromScalarValues(
  argumentCount: number,
  values: Expr[],
): PositionalArcValues | null {
  if (values.length === 2 || values.length === 3)
    return { end: [values[0], values[1]], radius: values[2] };
  if (values.length === 4 || values.length === 5) {
    return {
      start: [values[0], values[1]],
      end: [values[2], values[3]],
      radius: values[4],
    };
  }
  return argumentCount === 0 ? {} : null;
}

/** Checks whether the name belongs to the supported arc argument slots. */
function isArcArgumentName(name: string): boolean {
  return ['start', 'from', 'end', 'to', 'radius', 'r', 'direction'].includes(
    name,
  );
}

/** Maps argument aliases to the canonical endpoint/radius slots. */
function canonicalArcArgName(name: string): 'start' | 'end' | 'radius' | null {
  if (name === 'start' || name === 'from') return 'start';
  if (name === 'end' || name === 'to') return 'end';
  if (name === 'radius' || name === 'r') return 'radius';
  return null;
}

/** Reads a named endpoint only when it uses the required tuple point form. */
function tuplePoint(expr: Expr | undefined): [Expr, Expr] | undefined {
  return expr && isPointExpr(expr) ? pointFromExpr(expr) : undefined;
}

/** Reads a direction word supplied through `direction:`. */
function directionExpr(expr: Expr): 'cw' | 'ccw' | undefined {
  if (expr.kind !== 'identifier') return undefined;
  if (expr.name === 'cw' || expr.name === 'clockwise') return 'cw';
  if (expr.name === 'ccw' || expr.name === 'counterclockwise') return 'ccw';
  return undefined;
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
