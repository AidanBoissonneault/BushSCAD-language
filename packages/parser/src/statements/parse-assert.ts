/**
 * @author Aidan Boissonneault
 * @file parse-assert.ts
 * @purpose Parses assert for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type { AssertStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { tryParseNamedCallArg } from '../expressions/parse-call-arguments.js';

/**
 * Parses assert from the supplied source into the statements representation.
 */
export function parseAssert(p: Parser): AssertStatement {
  const start = p.peek().span;
  p.advance(); // ASSERT
  p.expect('LPAREN', 'assert syntax is assert(condition)');
  const args = parseAssertCallArgs(p);
  p.expect('RPAREN');
  p.eatSemi();
  return {
    kind: 'assert',
    condition: args.condition ?? missingCondition(p),
    severity: args.severity,
    message: args.message,
    span: p.spanFrom(start),
  };
}

/**
 * Assert args, including condition, severity, and message.
 */
type AssertArgs = {
  condition: AssertStatement['condition'] | null;
  severity: 'error' | 'warning';
  message: string | null;
};

/**
 * Parses call-style design assertions into the existing AssertStatement AST.
 * Assertions are expressions with optional reporting metadata, so named labels
 * make longer validation rules easier to scan while keeping concise positional
 * forms available.
 */
function parseAssertCallArgs(p: Parser): AssertArgs {
  const args: AssertArgs = {
    condition: null,
    severity: 'error',
    message: null,
  };
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseAssertNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseAssertPositionalArg(p, args, positional);
    positional++;
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse assert named arg and reports whether it succeeds.
 */
function tryParseAssertNamedArg(p: Parser, args: AssertArgs): boolean {
  return tryParseNamedCallArg(p, 'assert', {
    condition: () => (args.condition = p.parseExpr()),
    severity: () => (args.severity = parseAssertSeverity(p)),
    message: () => (args.message = p.expect('STRING').value),
    warning: () => parseWarningMessage(p, args),
  });
}

/**
 * Parses warning message from the supplied source into the statements representation.
 */
function parseWarningMessage(p: Parser, args: AssertArgs): void {
  args.severity = 'warning';
  args.message = p.expect('STRING').value;
}

/**
 * Parses assert positional arg from the supplied source into the statements representation.
 */
function parseAssertPositionalArg(
  p: Parser,
  args: AssertArgs,
  index: number,
): void {
  if (index === 0) {
    args.condition = p.parseExpr();
    return;
  }
  if (index === 1 && p.check('WARNING')) {
    args.severity = 'warning';
    p.advance();
    return;
  }
  if (index === 1 && p.check('STRING')) {
    args.message = p.advance().value;
    return;
  }
  if (index === 2 && p.check('STRING')) {
    args.message = p.advance().value;
    return;
  }
  p.addError(
    'assert() accepts condition, severity, and message',
    p.peek().span,
  );
  p.advance();
}

/**
 * Parses assert severity from the supplied source into the statements representation.
 */
function parseAssertSeverity(p: Parser): 'error' | 'warning' {
  const tok = p.advance();
  if (tok.value === 'error' || tok.value === 'warning') return tok.value;
  p.addError(`Unknown assert severity '${tok.value}'`, tok.span);
  return 'error';
}

/**
 * Handles missing condition in the statements flow.
 */
function missingCondition(p: Parser): AssertStatement['condition'] {
  const span = p.peek().span;
  p.addError('assert() requires condition', span);
  return { kind: 'bool', value: true, span };
}
