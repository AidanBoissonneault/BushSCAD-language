/**
 * @author Aidan Boissonneault
 * @file parse-fit.ts
 * @purpose Parses fit for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { FitDecl, FitKind, ToleranceLevel } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { tryParseNamedCallArg } from '../expressions/parse-call-arguments.js';

const FIT_KINDS = new Set([
  'clearance',
  'slip',
  'press',
  'interference',
  'loose',
  'tight',
]);
const TOLERANCE_LEVELS = new Set(['normal', 'tight', 'loose']);

/**
 * Parses fit declaration from the supplied source into the objects representation.
 */
export function parseFitDecl(p: Parser): FitDecl {
  const start = p.peek().span;
  p.advance(); // FIT
  p.expect('LPAREN', 'fit syntax is fit(kind, name, through|into, target)');
  const args = parseFitCallArgs(p);
  p.expect('RPAREN');
  p.requireSemi();
  return finalizeFitDecl(p, args, start);
}

/**
 * Fit args, including fit kind, fit name, relation, target name, and tolerance level.
 */
type FitArgs = {
  fitKind: FitKind | null;
  fitName: string | null;
  relation: 'through' | 'into' | null;
  targetName: string | null;
  toleranceLevel: ToleranceLevel;
  supplied: Set<FitArgSlot>;
};

type FitArgSlot =
  'fitKind' | 'fitName' | 'relation' | 'targetName' | 'toleranceLevel';

const FIT_POSITIONAL_SLOTS: readonly FitArgSlot[] = [
  'fitKind',
  'fitName',
  'relation',
  'targetName',
  'toleranceLevel',
];

/**
 * Parses call-style fit declarations into the existing fit AST.
 * Fit intent has a natural positional order but benefits from optional keyword
 * labels for readability in longer declarations.
 */
function parseFitCallArgs(p: Parser): FitArgs {
  const args: FitArgs = {
    fitKind: null,
    fitName: null,
    relation: null,
    targetName: null,
    toleranceLevel: 'normal',
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseFitNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseFitPositionalArg(p, args);
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse fit named arg and reports whether it succeeds.
 */
function tryParseFitNamedArg(p: Parser, args: FitArgs): boolean {
  return tryParseNamedCallArg(p, 'fit', {
    kind: (span) => assignFitSlot(p, args, 'fitKind', parseFitKind(p), span),
    type: (span) => assignFitSlot(p, args, 'fitKind', parseFitKind(p), span),
    name: (span) =>
      assignFitSlot(p, args, 'fitName', p.expect('IDENT').value, span),
    fit: (span) =>
      assignFitSlot(p, args, 'fitName', p.expect('IDENT').value, span),
    relation: (span) =>
      assignFitSlot(p, args, 'relation', parseFitRelation(p), span),
    target: (span) =>
      assignFitSlot(p, args, 'targetName', p.expect('IDENT').value, span),
    object: (span) =>
      assignFitSlot(p, args, 'targetName', p.expect('IDENT').value, span),
    tolerance: (span) =>
      assignFitSlot(p, args, 'toleranceLevel', parseToleranceLevel(p), span),
  });
}

/**
 * Parses fit positional arg from the supplied source into the objects representation.
 */
function parseFitPositionalArg(p: Parser, args: FitArgs): void {
  const slot = FIT_POSITIONAL_SLOTS.find(
    (candidate) => !args.supplied.has(candidate),
  );
  if (!slot) {
    p.addError('fit() accepts at most 5 positional arguments', p.peek().span);
    p.advance();
    return;
  }
  const span = p.peek().span;
  assignFitSlot(p, args, slot, parseFitSlotValue(p, slot), span);
}

/** Parses the value belonging to the next open fit argument slot. */
function parseFitSlotValue(p: Parser, slot: FitArgSlot): string {
  if (slot === 'fitKind') return parseFitKind(p);
  if (slot === 'relation') return parseFitRelation(p);
  if (slot === 'toleranceLevel') return parseToleranceLevel(p);
  return p.expect('IDENT').value;
}

/** Stores one fit value and diagnoses a repeated label or positional slot. */
function assignFitSlot(
  p: Parser,
  args: FitArgs,
  slot: FitArgSlot,
  value: string,
  span: import('@bushscad/ir').ASTSourceSpan,
): void {
  if (args.supplied.has(slot)) {
    p.addError(`fit() got duplicate argument '${slot}'`, span);
    return;
  }
  args.supplied.add(slot);
  if (slot === 'fitKind') args.fitKind = value as FitKind;
  else if (slot === 'fitName') args.fitName = value;
  else if (slot === 'relation') args.relation = value as 'through' | 'into';
  else if (slot === 'targetName') args.targetName = value;
  else args.toleranceLevel = value as ToleranceLevel;
}

/**
 * Parses fit kind from the supplied source into the objects representation.
 */
function parseFitKind(p: Parser): FitKind {
  const kindTok = p.expect('IDENT');
  if (!FIT_KINDS.has(kindTok.value)) {
    p.addError(
      `Unknown fit kind '${kindTok.value}'. Expected: clearance, slip, press, interference, loose, tight`,
      kindTok.span,
    );
  }
  return kindTok.value as FitKind;
}

/**
 * Parses fit relation from the supplied source into the objects representation.
 */
function parseFitRelation(p: Parser): 'through' | 'into' {
  if (p.check('THROUGH')) {
    p.advance();
    return 'through';
  }
  if (p.check('INTO')) {
    p.advance();
    return 'into';
  }
  p.addError(`Expected 'through' or 'into'`, p.peek().span);
  p.advance();
  return 'through';
}

/**
 * Parses tolerance level from the supplied source into the objects representation.
 */
function parseToleranceLevel(p: Parser): ToleranceLevel {
  const levelTok = p.expect('IDENT');
  if (!TOLERANCE_LEVELS.has(levelTok.value)) {
    p.addError(
      `Unknown tolerance level '${levelTok.value}'. Expected: normal, tight, loose`,
      levelTok.span,
    );
  }
  return levelTok.value as ToleranceLevel;
}

/**
 * Handles finalize fit declaration in the objects flow.
 */
function finalizeFitDecl(
  p: Parser,
  args: FitArgs,
  start: FitDecl['span'],
): FitDecl {
  if (!args.fitKind) p.addError('fit() requires kind', p.spanFrom(start));
  if (!args.fitName) p.addError('fit() requires name', p.spanFrom(start));
  if (!args.relation) p.addError('fit() requires relation', p.spanFrom(start));
  if (!args.targetName) p.addError('fit() requires target', p.spanFrom(start));
  return {
    kind: 'fit',
    fitKind: args.fitKind ?? 'clearance',
    fitName: args.fitName ?? '',
    relation: args.relation ?? 'through',
    targetName: args.targetName ?? '',
    toleranceLevel: args.toleranceLevel,
    span: p.spanFrom(start),
  };
}
