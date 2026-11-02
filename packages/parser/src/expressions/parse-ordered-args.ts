/**
 * @author Aidan Boissonneault
 * @file parse-ordered-args.ts
 * @purpose Parses ordered args for the expressions in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Ordered arg slot, including name, aliases, enum values, required, and positional.
 */
type OrderedArgSlot<Name extends string> = {
  name: Name;
  aliases?: readonly string[];
  enumValues?: readonly string[];
  required?: boolean;
  positional?: boolean;
};

/**
 * Defines the generic `ParsedOrderedArgs` contract parameterized by Name for the expressions layer.
 */
type ParsedOrderedArgs<Name extends string> = Partial<Record<Name, Expr>>;

/**
 * Parses a mixed positional/named expression list into canonical slots.
 * M40 lets built-in value arguments omit labels while preserving the existing
 * typed AST. This helper centralizes slot filling, alias handling, and recovery
 * diagnostics so each built-in parser only names its meaningful parameters.
 */
export function parseOrderedExprArgs<Name extends string>(
  p: Parser,
  callName: string,
  slots: readonly OrderedArgSlot<Name>[],
): ParsedOrderedArgs<Name> {
  const result: ParsedOrderedArgs<Name> = {};
  const aliasToName = buildAliasMap(slots);

  while (!p.check('RPAREN', 'EOF')) {
    if (isNamedArgStart(p)) {
      parseNamedArg(p, callName, aliasToName, result);
    } else {
      parsePositionalArg(p, callName, slots, result);
    }
    if (p.check('COMMA') && p.peek(1).kind === 'AT_SIGN') break;
    if (!p.eat('COMMA')) break;
  }

  for (const slot of slots) {
    if (slot.required && !result[slot.name]) {
      p.addError(
        `${callName}() requires argument '${slot.name}'`,
        p.peek().span,
      );
      result[slot.name] = missingArgStub(p);
    }
  }
  return result;
}

/**
 * Builds alias map from the supplied inputs.
 */
function buildAliasMap<Name extends string>(
  slots: readonly OrderedArgSlot<Name>[],
): Map<string, Name> {
  const aliasToName = new Map<string, Name>();
  for (const slot of slots) {
    aliasToName.set(slot.name, slot.name);
    for (const alias of slot.aliases ?? []) aliasToName.set(alias, slot.name);
  }
  return aliasToName;
}

/**
 * Returns whether the input meets the `named arg start` condition.
 */
function isNamedArgStart(p: Parser): boolean {
  return p.isNamedArgToken(p.peek()) && p.peek(1).kind === 'COLON';
}

/**
 * Parses named arg from the supplied source into the expressions representation.
 */
function parseNamedArg<Name extends string>(
  p: Parser,
  callName: string,
  aliasToName: Map<string, Name>,
  result: ParsedOrderedArgs<Name>,
): void {
  const nameToken = p.advance();
  p.advance(); // COLON
  const canonical = aliasToName.get(nameToken.value);
  const value = p.parseExpr();
  if (!canonical) {
    p.addError(
      `${callName}() does not accept argument '${nameToken.value}'`,
      nameToken.span,
    );
    return;
  }
  if (result[canonical]) {
    p.addError(
      `${callName}() got duplicate argument '${canonical}'`,
      nameToken.span,
    );
    return;
  }
  result[canonical] = value;
}

/**
 * Parses positional arg from the supplied source into the expressions representation.
 */
function parsePositionalArg<Name extends string>(
  p: Parser,
  callName: string,
  slots: readonly OrderedArgSlot<Name>[],
  result: ParsedOrderedArgs<Name>,
): void {
  const enumSlot = bareEnumSlot(p, slots, result, false);
  if (enumSlot) {
    result[enumSlot.name] = p.parseExpr();
    return;
  }
  const duplicateEnum = bareEnumSlot(p, slots, result, true);
  if (duplicateEnum) {
    const token = p.advance();
    p.addError(
      `${callName}() got duplicate argument '${duplicateEnum.name}'`,
      token.span,
    );
    return;
  }

  const slot = nextPositionalSlot(slots, result);
  const value = p.parseExpr();
  if (!slot) {
    p.addError(
      `${callName}() accepts at most ${positionalSlotCount(slots)} positional argument(s)`,
      value.span,
    );
    return;
  }
  result[slot.name] = value;
}

/**
 * Handles bare enum slot in the expressions flow.
 */
function bareEnumSlot<Name extends string>(
  p: Parser,
  slots: readonly OrderedArgSlot<Name>[],
  result: ParsedOrderedArgs<Name>,
  alreadyParsed: boolean,
): OrderedArgSlot<Name> | null {
  if (p.peek().kind !== 'IDENT') return null;
  const value = p.peek().value;
  return (
    slots.find(
      (slot) =>
        slot.enumValues?.includes(value) &&
        slot.positional === false &&
        Boolean(result[slot.name]) === alreadyParsed,
    ) ?? null
  );
}

/**
 * Handles next positional slot in the expressions flow.
 */
function nextPositionalSlot<Name extends string>(
  slots: readonly OrderedArgSlot<Name>[],
  parsed: ParsedOrderedArgs<Name>,
): OrderedArgSlot<Name> | null {
  return (
    slots.find((slot) => slot.positional !== false && !parsed[slot.name]) ??
    null
  );
}

/**
 * Handles positional slot count in the expressions flow.
 */
function positionalSlotCount(slots: readonly OrderedArgSlot<string>[]): number {
  return slots.filter((slot) => slot.positional !== false).length;
}

/**
 * Handles missing arg stub in the expressions flow.
 */
function missingArgStub(p: Parser): Expr {
  const span = p.peek().span;
  return { kind: 'number', value: 0, span };
}
