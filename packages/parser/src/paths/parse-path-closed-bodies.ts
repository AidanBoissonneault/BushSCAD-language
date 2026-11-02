/**
 * @author Aidan Boissonneault
 * @file parse-path-closed-bodies.ts
 * @purpose Parses path closed bodies for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  PathClosedBodyDecl,
  PathIgnoredClosedBodyDecl,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { expectName, isNameToken } from '../expressions/parse-names.js';
import { missingPoint, parseExprList } from './parse-path-args.js';

/**
 * Parses `name = closed(...)` declarations inside path sketches.
 * Closed body declarations are path-local metadata, not segments, so they stay
 * separate from line/arc/close parsing and constraint target collection.
 */
export function parseClosedBodyDecl(
  p: Parser,
  closedBodies: PathClosedBodyDecl[],
): boolean {
  if (!isNameToken(p.peek()) || p.peek(1).kind !== 'ASSIGN') return false;
  if (p.peek(2).kind !== 'IDENT' || p.peek(2).value !== 'closed') return false;
  const start = p.peek().span;
  const name = expectName(p).value;
  p.expect('ASSIGN');
  p.advance();
  p.expect('LPAREN');
  const point = parseClosedPointArgs(p, 'closed');
  p.expect('RPAREN');
  closedBodies.push({
    kind: 'closedBody',
    name,
    point,
    span: p.spanFrom(start),
  });
  return true;
}

/** Parses `ignoreClosed(...)` declarations inside path sketches. */
export function parseIgnoredClosedBodyDecl(
  p: Parser,
  ignoredClosedBodies: PathIgnoredClosedBodyDecl[],
): boolean {
  if (p.peek().kind !== 'IDENT' || p.peek().value !== 'ignoreClosed') {
    return false;
  }
  const start = p.advance().span;
  p.expect('LPAREN');
  const point = parseClosedPointArgs(p, 'ignoreClosed');
  p.expect('RPAREN');
  ignoredClosedBodies.push({
    kind: 'ignoredClosedBody',
    point,
    span: p.spanFrom(start),
  });
  return true;
}

/**
 * Parses closed point args from the supplied source into the paths representation.
 */
function parseClosedPointArgs(
  p: Parser,
  callName: 'closed' | 'ignoreClosed',
): [Expr, Expr] {
  const args = parseExprList(p);
  if (args.length === 1 && args[0].kind === 'tuple') {
    return [args[0].x, args[0].y];
  }
  if (args.length === 2) return [args[0], args[1]];
  p.addError(
    `${callName}() expects ${callName}(x, y) or ${callName}((x, y)).`,
    p.peek().span,
  );
  return missingPoint(p);
}
