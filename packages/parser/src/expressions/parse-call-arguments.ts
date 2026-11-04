/**
 * @author Aidan Boissonneault
 * @file parse-call-arguments.ts
 * @purpose Parses call arguments for the expressions in parser package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Defines the `NamedArgHandler` callback contract used by the expressions layer.
 */
export type NamedArgHandler = (span: ASTSourceSpan) => void;

/** Claims one canonical call slot and reports duplicate positional or labeled values. */
export function claimCallArgument(
  p: Parser,
  callName: string,
  slot: string,
  supplied: Set<string>,
  span: ASTSourceSpan,
): boolean {
  if (supplied.has(slot)) {
    p.addError(`${callName}() got duplicate argument '${slot}'`, span);
    return false;
  }
  supplied.add(slot);
  return true;
}

/** Parses one labeled value and stores it only when its canonical slot is free. */
export function parseAndClaimCallArgument<T>(
  p: Parser,
  callName: string,
  slot: string,
  supplied: Set<string>,
  span: ASTSourceSpan,
  parseValue: () => T,
): T | undefined {
  const value = parseValue();
  return claimCallArgument(p, callName, slot, supplied, span)
    ? value
    : undefined;
}

/**
 * Consumes a named call argument and dispatches it to a caller-provided handler.
 * Statement-call syntaxes share the same `name: value` detection and unknown
 * argument recovery, but each command owns different value parsers.
 */
export function tryParseNamedCallArg(
  p: Parser,
  callName: string,
  handlers: Readonly<Record<string, NamedArgHandler>>,
): boolean {
  if (!p.isNamedArgToken(p.peek()) || p.peek(1).kind !== 'COLON') return false;
  const nameTok = p.advance();
  p.advance(); // COLON
  const handler = handlers[nameTok.value];
  if (handler) {
    handler(nameTok.span);
  } else {
    p.addError(
      `${callName}() does not accept argument '${nameTok.value}'`,
      nameTok.span,
    );
    p.parseExpr();
  }
  return true;
}
