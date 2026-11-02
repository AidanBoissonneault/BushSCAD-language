/**
 * @author Aidan Boissonneault
 * @file parse-thread.ts
 * @purpose Parses thread for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  ThreadDetail,
  ThreadDirection,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { tryParseNamedCallArg } from '../expressions/parse-call-arguments.js';
import { parseObjectTargetName } from '../expressions/parse-names.js';

/**
 * Thread params, including target, thread type, diameter, pitch, and length.
 */
type ThreadParams = {
  target: string | null;
  threadType: 'external' | 'internal' | null;
  diameter: Expr | null;
  pitch: Expr | null;
  length: Expr | null;
  direction: ThreadDirection;
  angle: Expr | null;
};

/**
 * Parses thread modifiers into the existing AST shape.
 * Thread syntax now follows the same positional-with-keyword-overrides pattern
 * as other built-ins while preserving the evaluator-facing ThreadDetail shape.
 */
export function parseThread(p: Parser): ThreadDetail {
  const start = p.peek().span;
  p.advance(); // THREAD
  const params = defaultThreadParams();

  p.expect('LPAREN', 'thread syntax is thread(target, type, d, pitch, ...)');
  parseThreadCallArgs(p, params);
  p.expect('RPAREN');

  finalizeThreadParams(p, params, start);
  p.eatSemi();
  return {
    kind: 'thread',
    target: params.target!,
    threadType: params.threadType!,
    diameter: params.diameter!,
    pitch: params.pitch!,
    length: params.length,
    direction: params.direction,
    angle: params.angle,
    span: p.spanFrom(start),
  };
}

/**
 * Returns the default thread params used by this module.
 */
function defaultThreadParams(): ThreadParams {
  return {
    target: null,
    threadType: null,
    diameter: null,
    pitch: null,
    length: null,
    direction: 'regular',
    angle: null,
  };
}

/**
 * Parses thread call args from the supplied source into the statements representation.
 */
function parseThreadCallArgs(p: Parser, params: ThreadParams): void {
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    const named = parseThreadNamedArg(p, params);
    if (!named) {
      parseThreadPositionalArg(p, params, positional);
      positional++;
    }
    if (!p.eat('COMMA')) break;
  }
}

/**
 * Parses thread named arg from the supplied source into the statements representation.
 */
function parseThreadNamedArg(p: Parser, params: ThreadParams): boolean {
  return tryParseNamedCallArg(p, 'thread', threadParamHandlers(p, params));
}

/**
 * Parses thread positional arg from the supplied source into the statements representation.
 */
function parseThreadPositionalArg(
  p: Parser,
  params: ThreadParams,
  index: number,
): void {
  if (index === 0) params.target = parseObjectTargetName(p);
  else if (index === 1) params.threadType = parseThreadType(p);
  else if (index === 2) params.diameter = p.parseExpr();
  else if (index === 3) params.pitch = p.parseExpr();
  else if (index === 4) params.length = p.parseExpr();
  else if (index === 5) params.direction = parseThreadDirection(p);
  else if (index === 6) params.angle = p.parseExpr();
  else {
    const extra = p.parseExpr();
    p.addError('thread() accepts at most 7 positional arguments', extra.span);
  }
}

/**
 * Handles thread param handlers in the statements flow.
 */
function threadParamHandlers(
  p: Parser,
  params: ThreadParams,
): Readonly<Record<string, (argSpan: Expr['span']) => void>> {
  return {
    target: () => (params.target = parseObjectTargetName(p)),
    object: () => (params.target = parseObjectTargetName(p)),
    type: () => (params.threadType = parseThreadType(p)),
    d: () => (params.diameter = p.parseExpr()),
    diameter: () => (params.diameter = p.parseExpr()),
    pitch: () => (params.pitch = p.parseExpr()),
    length: () => (params.length = p.parseExpr()),
    angle: () => (params.angle = p.parseExpr()),
    degrees: () => (params.angle = p.parseExpr()),
    depth: (argSpan) => parseRemovedThreadDepth(p, argSpan),
    direction: () => (params.direction = parseThreadDirection(p)),
    handedness: () => (params.direction = parseThreadDirection(p)),
    hand: () => (params.direction = parseThreadDirection(p)),
  };
}

/**
 * Parses thread type from the supplied source into the statements representation.
 */
function parseThreadType(p: Parser): 'external' | 'internal' {
  const typeTok = p.advance();
  if (typeTok.value === 'external' || typeTok.value === 'internal') {
    return typeTok.value;
  }
  p.addError(
    `Unknown thread type '${typeTok.value}'; expected 'external' or 'internal'`,
    typeTok.span,
  );
  return 'external';
}

/**
 * Parses removed thread depth from the supplied source into the statements representation.
 */
function parseRemovedThreadDepth(p: Parser, span: Expr['span']): void {
  p.addError(
    `Thread 'depth:' is no longer supported; use 'length:' to set thread extent`,
    span,
  );
  p.parseExpr();
}

/**
 * Handles finalize thread params in the statements flow.
 */
function finalizeThreadParams(
  p: Parser,
  params: ThreadParams,
  start: ASTSourceSpan,
): void {
  if (params.target === null) {
    p.addError(`Thread requires a target object`, p.spanFrom(start));
    params.target = '';
  }
  if (params.threadType === null) {
    p.addError(
      `Thread requires 'type: external' or 'type: internal'`,
      p.spanFrom(start),
    );
    params.threadType = 'external';
  }
  if (params.diameter === null) {
    p.addError(`Thread requires 'd: <diameter>'`, p.spanFrom(start));
    params.diameter = missingNumber(p, start);
  }
  if (params.pitch === null) {
    p.addError(`Thread requires 'pitch: <pitch>'`, p.spanFrom(start));
    params.pitch = missingNumber(p, start);
  }
}

/**
 * Handles missing number in the statements flow.
 */
function missingNumber(p: Parser, start: ASTSourceSpan): Expr {
  return { kind: 'number', value: 0, span: p.spanFrom(start) };
}

/**
 * Parses thread direction from the supplied source into the statements representation.
 */
function parseThreadDirection(p: Parser): ThreadDirection {
  const first = p.advance();
  const normalized = first.value.toLowerCase().replace(/-/g, '_');
  if (
    normalized === 'counter' &&
    p.peek().value?.toLowerCase() === 'clockwise'
  ) {
    p.advance();
    return 'counter_clockwise';
  }
  if (
    normalized === 'regular' ||
    normalized === 'clockwise' ||
    normalized === 'counter_clockwise' ||
    normalized === 'counterclockwise'
  ) {
    return normalized === 'counterclockwise' ? 'counter_clockwise' : normalized;
  }
  p.addError(
    `Unknown thread direction '${first.value}'; expected 'regular', 'clockwise', or 'counter_clockwise'`,
    first.span,
  );
  return 'regular';
}
