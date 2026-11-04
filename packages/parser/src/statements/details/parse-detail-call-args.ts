/** Shared argument normalization for fillet, chamfer, and draft calls. */

import type { Expr, RepeatableFaceRef } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

import {
  parseAndClaimCallArgument,
  tryParseNamedCallArg,
} from '../../expressions/parse-call-arguments.js';

type DetailCallName = 'fillet' | 'chamfer' | 'draft';

/** Mutable state for the target and required value of one detail modifier. */
type DetailCallArgs = {
  target: RepeatableFaceRef | null;
  value: Expr | null;
  supplied: Set<string>;
};

/** Parses a detail target and its required value from positional or labeled slots. */
export function parseDetailCallArgs(
  p: Parser,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): { target: RepeatableFaceRef; value: import('@bushscad/ir').Expr } {
  const args: DetailCallArgs = {
    target: null,
    value: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (!parseDetailNamedArg(p, args, operation, valueName))
      parseDetailPositionalArg(p, args, operation, valueName);
    if (!p.eat('COMMA')) break;
  }

  return finalizeDetailCallArgs(p, args, operation, valueName);
}

/** Parses a labeled target/value pair for a body detail modifier. */
function parseDetailNamedArg(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): boolean {
  return tryParseNamedCallArg(p, operation, {
    target: (span) => parseDetailTargetNamedArg(p, args, operation, span),
    object: (span) => parseDetailTargetNamedArg(p, args, operation, span),
    [valueName]: (span) => {
      args.value =
        parseAndClaimCallArgument(
          p,
          operation,
          valueName,
          args.supplied,
          span,
          () => p.parseExpr(),
        ) ?? args.value;
    },
  });
}

/** Parses and stores a named face-selection target once. */
function parseDetailTargetNamedArg(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  span: Expr['span'],
): void {
  args.target =
    parseAndClaimCallArgument(p, operation, 'target', args.supplied, span, () =>
      parseModifierTarget(p, operation),
    ) ?? args.target;
}

/** Fills the next unassigned positional slot of a detail modifier. */
function parseDetailPositionalArg(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): void {
  if (!args.supplied.has('target')) {
    args.target = parseModifierTarget(p, operation);
    args.supplied.add('target');
  } else if (!args.supplied.has(valueName)) {
    args.value = p.parseExpr();
    args.supplied.add(valueName);
  } else {
    const extra = p.parseExpr();
    p.addError(
      `${operation}() accepts only a target and ${valueName}`,
      extra.span,
    );
  }
}

/** Supplies required placeholders after reporting missing detail call inputs. */
function finalizeDetailCallArgs(
  p: Parser,
  args: DetailCallArgs,
  operation: DetailCallName,
  valueName: 'radius' | 'offset' | 'angle',
): { target: RepeatableFaceRef; value: Expr } {
  const span = p.peek().span;
  if (!args.target) {
    p.addError(`${operation}() requires a target`, span);
    args.target = { kind: 'faceRef', chain: [], span };
  }
  if (!args.value) {
    p.addError(`${operation}() requires ${valueName}`, span);
    args.value = { kind: 'number', value: 0, span };
  }
  return { target: args.target, value: args.value };
}

/**
 * Parses a function-style modifier target.
 *
 * Modifiers now consume the same selectable `@` references as placement and
 * anchors, but their target must stay a feature reference rather than an
 * offset placement.
 */
function parseModifierTarget(
  p: Parser,
  modifierName: DetailCallName,
): RepeatableFaceRef {
  if (!p.check('AT_SIGN') && !p.check('LBRACKET')) {
    p.fail(`${modifierName}(...) expects an @ reference target`, p.peek().span);
  }
  const target = p.parsePlacement();
  if (target.kind === 'faceRef' || target.kind === 'faceRefList') return target;
  p.addError(
    `${modifierName}(...) target cannot include placement offsets`,
    target.span,
  );
  return Array.isArray(target.anchor)
    ? { kind: 'faceRef', chain: [], span: target.span }
    : target.anchor;
}
