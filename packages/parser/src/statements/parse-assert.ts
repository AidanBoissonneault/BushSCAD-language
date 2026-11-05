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
  p.requireSemi();
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
  supplied: Set<'condition' | 'severity' | 'message'>;
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
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseAssertNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseAssertPositionalArg(p, args);
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse assert named arg and reports whether it succeeds.
 */
function tryParseAssertNamedArg(p: Parser, args: AssertArgs): boolean {
  return tryParseNamedCallArg(p, 'assert', {
    condition: (span) =>
      assignAssertValue(
        p,
        args,
        'condition',
        span,
        () => (args.condition = p.parseExpr()),
      ),
    severity: (span) =>
      assignAssertValue(
        p,
        args,
        'severity',
        span,
        () => (args.severity = parseAssertSeverity(p)),
      ),
    message: (span) =>
      assignAssertValue(
        p,
        args,
        'message',
        span,
        () => (args.message = p.expect('STRING').value),
      ),
    warning: (span) => parseWarningArg(p, args, span),
  });
}

/** Applies one assertion slot and reports duplicate positional or named values. */
function assignAssertValue(
  p: Parser,
  args: AssertArgs,
  slot: 'condition' | 'severity' | 'message',
  span: import('@bushscad/ir').ASTSourceSpan,
  assign: () => void,
): void {
  if (args.supplied.has(slot)) {
    p.addError(`assert() got duplicate argument '${slot}'`, span);
    p.parseExpr();
    return;
  }
  args.supplied.add(slot);
  assign();
}

/**
 * Parses warning message from the supplied source into the statements representation.
 */
function parseWarningMessage(p: Parser, args: AssertArgs): void {
  args.severity = 'warning';
  args.message = p.expect('STRING').value;
  args.supplied.add('message');
}

/** Parses the warning shorthand and diagnoses repeated severity or message values. */
function parseWarningArg(
  p: Parser,
  args: AssertArgs,
  span: import('@bushscad/ir').ASTSourceSpan,
): void {
  if (args.supplied.has('severity')) {
    p.addError("assert() got duplicate argument 'severity'", span);
  } else {
    args.supplied.add('severity');
    args.severity = 'warning';
  }
  if (args.supplied.has('message')) {
    p.addError("assert() got duplicate argument 'message'", span);
    p.parseExpr();
  } else {
    parseWarningMessage(p, args);
  }
}

/**
 * Parses assert positional arg from the supplied source into the statements representation.
 */
function parseAssertPositionalArg(p: Parser, args: AssertArgs): void {
  if (!args.supplied.has('condition')) {
    args.supplied.add('condition');
    args.condition = p.parseExpr();
    return;
  }
  if (
    !args.supplied.has('severity') &&
    (p.check('WARNING') ||
      (p.peek().kind === 'IDENT' &&
        ['error', 'warning'].includes(p.peek().value)))
  ) {
    args.supplied.add('severity');
    args.severity = parseAssertSeverity(p);
    return;
  }
  if (!args.supplied.has('message') && p.check('STRING')) {
    args.supplied.add('message');
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
