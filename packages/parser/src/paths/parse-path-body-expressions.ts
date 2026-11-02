/**
 * @author Aidan Boissonneault
 * @file parse-path-body-expressions.ts
 * @purpose Parses path body expressions for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  PathBodyExpression,
  PathBodyExpressionDecl,
  PathBodyBoolean,
  PathIgnoredBodyExpressionDecl,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { expectName, isNameToken } from '../expressions/parse-names.js';

/**
 * Parses `name = <body expression>` declarations inside `path(...)`.
 * Body algebra is path-local metadata and must be recognized before the segment
 * parser interprets the same leading `name =` tokens as a named path segment.
 */
export function parsePathBodyExpressionDecl(
  p: Parser,
  declarations: PathBodyExpressionDecl[],
): boolean {
  if (!isNameToken(p.peek()) || p.peek(1).kind !== 'ASSIGN') return false;
  if (!isBodyExpressionStart(p, 2)) return false;
  const start = p.peek().span;
  const name = expectName(p).value;
  p.expect('ASSIGN');
  declarations.push({
    kind: 'bodyExpression',
    name,
    expression: parsePathBodyExpression(p),
    span: p.spanFrom(start),
  });
  return true;
}

/** Parses `ignore(<body expression>)` path-local exclusion metadata. */
export function parsePathIgnoredBodyExpressionDecl(
  p: Parser,
  declarations: PathIgnoredBodyExpressionDecl[],
): boolean {
  if (
    p.peek().kind !== 'IDENT' ||
    p.peek().value !== 'ignore' ||
    p.peek(1).kind !== 'LPAREN'
  ) {
    return false;
  }
  const start = p.advance().span;
  p.expect('LPAREN');
  const expression = parsePathBodyExpression(p);
  p.expect('RPAREN');
  declarations.push({
    kind: 'ignoredBodyExpression',
    expression,
    span: p.spanFrom(start),
  });
  return true;
}

/**
 * Parses union/subtract expressions, with intersection binding more tightly.
 *
 * All operators are left-associative within their precedence level so body
 * algebra follows the existing sketch `+` and `-` composition convention.
 */
export function parsePathBodyExpression(p: Parser): PathBodyExpression {
  let left = parseIntersection(p);
  while (p.check('PLUS', 'MINUS')) {
    const start = left.span;
    const token = p.advance();
    const right = parseIntersection(p);
    left = bodyBoolean(
      token.kind === 'PLUS' ? 'union' : 'subtract',
      left,
      right,
      p.spanFrom(start),
    );
  }
  return left;
}

/**
 * Parses intersection from the supplied source into the paths representation.
 */
function parseIntersection(p: Parser): PathBodyExpression {
  let left = parseBodyPrimary(p);
  while (p.eat('AMPERSAND')) {
    const start = left.span;
    const right = parseBodyPrimary(p);
    left = bodyBoolean('intersect', left, right, p.spanFrom(start));
  }
  return left;
}

/**
 * Parses body primary from the supplied source into the paths representation.
 */
function parseBodyPrimary(p: Parser): PathBodyExpression {
  if (p.eat('LPAREN')) {
    const expression = parsePathBodyExpression(p);
    p.expect('RPAREN');
    return expression;
  }
  if (isLoopCallStart(p)) return parseLoopCall(p);
  if (isNameToken(p.peek())) {
    const name = expectName(p);
    return { kind: 'pathBodyRef', name: name.value, span: name.span };
  }
  p.fail(
    `Expected a body name, loop(feature), or parenthesized body expression, got ${p.peek().kind}`,
    p.peek().span,
  );
}

/**
 * Parses loop call from the supplied source into the paths representation.
 */
function parseLoopCall(p: Parser): PathBodyExpression {
  const start = p.advance().span;
  p.expect('LPAREN');
  const featureName = expectName(p, 'Expected a path feature name in loop()');
  p.expect('RPAREN');
  return {
    kind: 'pathBodyLoop',
    featureName: featureName.value,
    span: p.spanFrom(start),
  };
}

/**
 * Builds the body data required by the current operation.
 */
function bodyBoolean(
  op: PathBodyBoolean['op'],
  left: PathBodyExpression,
  right: PathBodyExpression,
  span: ASTSourceSpan,
): PathBodyBoolean {
  return { kind: 'pathBodyBoolean', op, left, right, span };
}

/**
 * Returns whether the input meets the `loop call start` condition.
 */
function isLoopCallStart(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    p.peek().value === 'loop' &&
    p.peek(1).kind === 'LPAREN'
  );
}

/**
 * Returns whether the input meets the `body expression start` condition.
 */
function isBodyExpressionStart(p: Parser, offset: number): boolean {
  const token = p.peek(offset);
  if (token.kind === 'LPAREN') return true;
  if (!isNameToken(token)) return false;
  const followedByCall = p.peek(offset + 1).kind === 'LPAREN';
  if (!followedByCall) return true;
  if (token.kind === 'LINE' || token.kind === 'ARC') return false;
  return token.value !== 'close' && token.value !== 'closed';
}
