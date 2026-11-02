/**
 * @author Aidan Boissonneault
 * @file parse-path-segments.ts
 * @purpose Parses path segments for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  PathSegment,
  PathSegmentItem,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { expectName, isNameToken } from '../expressions/parse-names.js';
import { missingPoint, parseExprList } from './parse-path-args.js';
import {
  linePointError,
  normalizeArcArgs,
  parseArcArgs,
  parseLinePoints,
} from './parse-path-points.js';

/**
 * Parses one named or anonymous line, arc, or close item inside `path(...)`.
 * Segment cursor syntax is independent from path-level body expressions and
 * annotations, so keeping it here leaves the constructor parser as dispatch.
 */
export function parsePathItem(p: Parser): PathSegmentItem[] {
  const start = p.peek().span;
  const construction = isConstructionPrefix(p);
  const plant = Boolean(p.eat('PLANT'));
  if (plant) return parsePlantedPathItem(p, start, construction);
  if (isNamedPathItemStart(p)) {
    const name = expectName(p).value;
    p.expect('ASSIGN');
    return namePathSegments(
      name,
      parsePathSegment(p),
      p.spanFrom(start),
      false,
      construction,
    );
  }
  return parsePathSegment(p).map((segment) => ({
    kind: 'segment',
    construction,
    segment,
    span: p.spanFrom(start),
  }));
}

/**
 * Parses planted path item from the supplied source into the paths representation.
 */
function parsePlantedPathItem(
  p: Parser,
  start: ASTSourceSpan,
  construction: boolean,
): PathSegmentItem[] {
  if (!isNamedPathItemStart(p)) {
    p.addError(
      'Planted sketch elements must be named. Use plant name = line(...).',
      start,
    );
    return parsePathSegment(p).map((segment) => ({
      kind: 'segment',
      construction,
      plant: true,
      segment,
      span: p.spanFrom(start),
    }));
  }
  const name = expectName(p).value;
  p.expect('ASSIGN');
  return namePathSegments(
    name,
    parsePathSegment(p),
    p.spanFrom(start),
    true,
    construction,
  );
}

/**
 * Returns whether the input meets the `construction prefix` condition.
 */
function isConstructionPrefix(p: Parser): boolean {
  if (p.peek().kind !== 'IDENT' || p.peek().value !== 'construction') {
    return false;
  }
  p.advance();
  return true;
}

/**
 * Returns whether the input meets the `named path item start` condition.
 */
function isNamedPathItemStart(p: Parser): boolean {
  return isNameToken(p.peek()) && p.peek(1).kind === 'ASSIGN';
}

/**
 * Handles name path segments in the paths flow.
 */
function namePathSegments(
  name: string,
  segments: PathSegment[],
  span: ASTSourceSpan,
  plant = false,
  construction = false,
): PathSegmentItem[] {
  return segments.map((segment, index) => ({
    kind: 'segment',
    name: index === 0 ? name : `${name}_${index}`,
    construction,
    plant,
    segment,
    span,
  }));
}

/**
 * Parses path segment from the supplied source into the paths representation.
 */
function parsePathSegment(p: Parser): PathSegment[] {
  if (p.check('LINE')) return parsePathLine(p);
  if (p.check('ARC')) return [parsePathArc(p)];
  if (isCloseCallStart(p)) return [parsePathClose(p)];
  if (isMoveCallStart(p)) {
    p.addError(
      'move() is not supported in path(). The first segment establishes the start point.',
      p.peek().span,
    );
  }
  p.fail(
    `Expected line(...), arc(...), or close() in path(), got ${p.peek().kind}`,
    p.peek().span,
  );
}

/**
 * Parses path line from the supplied source into the paths representation.
 */
function parsePathLine(p: Parser): PathSegment[] {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseExprList(p);
  p.expect('RPAREN');
  const expanded = expandLinePointArray(args, p.spanFrom(start));
  if (expanded) return expanded;
  const points = parseLinePoints(args);
  if (points.kind === 'explicit') {
    return [
      {
        kind: 'line',
        form: 'explicit',
        start: points.start,
        end: points.end,
        span: p.spanFrom(start),
      },
    ];
  }
  if (points.kind === 'inferred') {
    return [
      {
        kind: 'line',
        form: 'inferred',
        end: points.end,
        span: p.spanFrom(start),
      },
    ];
  }
  p.addError(linePointError(args), start);
  return [
    {
      kind: 'line',
      form: 'inferred',
      end: missingPoint(p),
      span: p.spanFrom(start),
    },
  ];
}

/**
 * Expands line point array into its concrete entries.
 */
function expandLinePointArray(
  args: Expr[],
  span: ASTSourceSpan,
): PathSegment[] | null {
  if (args.length !== 1 || args[0].kind !== 'list') return null;
  const points = args[0].items;
  if (!points.every((point) => point.kind === 'tuple')) return null;
  return points.map((point) => ({
    kind: 'line',
    form: 'inferred',
    end: [point.x, point.y],
    span,
  }));
}

/**
 * Parses path arc from the supplied source into the paths representation.
 */
function parsePathArc(p: Parser): PathSegment {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseArcArgs(p);
  p.expect('RPAREN');
  const arc = normalizeArcArgs(args);
  if (!arc) {
    p.addError(
      'arc() in path() expects arc(x, y, radius, cw|ccw), arc((x, y), radius, cw|ccw), or arc((x1, y1), (x2, y2), radius, cw|ccw).',
      start,
    );
    const fallback = missingPoint(p);
    return {
      kind: 'arc',
      form: 'inferred',
      end: fallback,
      radius: fallback[0],
      direction: 'ccw',
      span: p.spanFrom(start),
    };
  }
  return {
    kind: 'arc',
    form: arc.start ? 'explicit' : 'inferred',
    start: arc.start,
    end: arc.end,
    radius: arc.radius,
    direction: arc.direction,
    span: p.spanFrom(start),
  };
}

/**
 * Parses path close from the supplied source into the paths representation.
 */
function parsePathClose(p: Parser): PathSegment {
  const start = p.advance().span;
  p.expect('LPAREN');
  p.expect('RPAREN');
  return { kind: 'close', span: p.spanFrom(start) };
}

/**
 * Returns whether the input meets the `close call start` condition.
 */
function isCloseCallStart(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    p.peek().value === 'close' &&
    p.peek(1).kind === 'LPAREN'
  );
}

/**
 * Returns whether the input meets the `move call start` condition.
 */
function isMoveCallStart(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    p.peek().value === 'move' &&
    p.peek(1).kind === 'LPAREN'
  );
}
