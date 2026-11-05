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
  supplied: Set<ThreadArgSlot>;
};

type ThreadArgSlot =
  | 'target'
  | 'threadType'
  | 'diameter'
  | 'pitch'
  | 'length'
  | 'direction'
  | 'angle';

const THREAD_POSITIONAL_SLOTS: readonly ThreadArgSlot[] = [
  'target',
  'threadType',
  'diameter',
  'pitch',
  'length',
  'direction',
  'angle',
];

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
  p.requireSemi();
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
    supplied: new Set(),
  };
}

/**
 * Parses thread call args from the supplied source into the statements representation.
 */
function parseThreadCallArgs(p: Parser, params: ThreadParams): void {
  while (!p.check('RPAREN', 'EOF')) {
    const named = parseThreadNamedArg(p, params);
    if (!named) parseThreadPositionalArg(p, params);
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
function parseThreadPositionalArg(p: Parser, params: ThreadParams): void {
  const slot = THREAD_POSITIONAL_SLOTS.find(
    (candidate) => !params.supplied.has(candidate),
  );
  if (!slot) {
    const extra = p.parseExpr();
    p.addError('thread() accepts at most 7 positional arguments', extra.span);
    return;
  }
  const span = p.peek().span;
  const value = parseThreadSlotValue(p, slot);
  assignThreadSlot(p, params, slot, value, span);
}

/**
 * Handles thread param handlers in the statements flow.
 */
function threadParamHandlers(
  p: Parser,
  params: ThreadParams,
): Readonly<Record<string, (argSpan: Expr['span']) => void>> {
  return {
    target: (span) =>
      assignThreadSlot(p, params, 'target', parseObjectTargetName(p), span),
    object: (span) =>
      assignThreadSlot(p, params, 'target', parseObjectTargetName(p), span),
    type: (span) =>
      assignThreadSlot(p, params, 'threadType', parseThreadType(p), span),
    d: (span) => assignThreadSlot(p, params, 'diameter', p.parseExpr(), span),
    diameter: (span) =>
      assignThreadSlot(p, params, 'diameter', p.parseExpr(), span),
    pitch: (span) => assignThreadSlot(p, params, 'pitch', p.parseExpr(), span),
    length: (span) =>
      assignThreadSlot(p, params, 'length', p.parseExpr(), span),
    angle: (span) => assignThreadSlot(p, params, 'angle', p.parseExpr(), span),
    degrees: (span) =>
      assignThreadSlot(p, params, 'angle', p.parseExpr(), span),
    depth: (argSpan) => parseRemovedThreadDepth(p, argSpan),
    direction: (span) =>
      assignThreadSlot(p, params, 'direction', parseThreadDirection(p), span),
    handedness: (span) =>
      assignThreadSlot(p, params, 'direction', parseThreadDirection(p), span),
    hand: (span) =>
      assignThreadSlot(p, params, 'direction', parseThreadDirection(p), span),
  };
}

/** Parses the value belonging to the next open thread argument slot. */
function parseThreadSlotValue(
  p: Parser,
  slot: ThreadArgSlot,
): string | Expr | ThreadDirection {
  if (slot === 'target') return parseObjectTargetName(p);
  if (slot === 'threadType') return parseThreadType(p);
  if (slot === 'direction') return parseThreadDirection(p);
  return p.parseExpr();
}

/** Stores a thread argument once and reports repeated positional or named inputs. */
function assignThreadSlot(
  p: Parser,
  params: ThreadParams,
  slot: ThreadArgSlot,
  value: string | Expr | ThreadDirection,
  span: Expr['span'],
): void {
  if (params.supplied.has(slot)) {
    p.addError(`thread() got duplicate argument '${slot}'`, span);
    return;
  }
  params.supplied.add(slot);
  if (slot === 'target') params.target = value as string;
  else if (slot === 'threadType')
    params.threadType = value as 'external' | 'internal';
  else if (slot === 'diameter') params.diameter = value as Expr;
  else if (slot === 'pitch') params.pitch = value as Expr;
  else if (slot === 'length') params.length = value as Expr;
  else if (slot === 'direction') params.direction = value as ThreadDirection;
  else params.angle = value as Expr;
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
    p.addError(`Thread requires type external or internal`, p.spanFrom(start));
    params.threadType = 'external';
  }
  if (params.diameter === null) {
    p.addError(`Thread requires diameter`, p.spanFrom(start));
    params.diameter = missingNumber(p, start);
  }
  if (params.pitch === null) {
    p.addError(`Thread requires pitch`, p.spanFrom(start));
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
