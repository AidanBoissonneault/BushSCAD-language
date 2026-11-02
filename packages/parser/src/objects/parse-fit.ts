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
  p.eatSemi();
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
};

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
  };
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseFitNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseFitPositionalArg(p, args, positional);
    positional++;
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Attempts to parse fit named arg and reports whether it succeeds.
 */
function tryParseFitNamedArg(p: Parser, args: FitArgs): boolean {
  return tryParseNamedCallArg(p, 'fit', {
    kind: () => (args.fitKind = parseFitKind(p)),
    type: () => (args.fitKind = parseFitKind(p)),
    name: () => (args.fitName = p.expect('IDENT').value),
    fit: () => (args.fitName = p.expect('IDENT').value),
    relation: () => (args.relation = parseFitRelation(p)),
    target: () => (args.targetName = p.expect('IDENT').value),
    object: () => (args.targetName = p.expect('IDENT').value),
    tolerance: () => (args.toleranceLevel = parseToleranceLevel(p)),
  });
}

/**
 * Parses fit positional arg from the supplied source into the objects representation.
 */
function parseFitPositionalArg(p: Parser, args: FitArgs, index: number): void {
  if (index === 0) args.fitKind = parseFitKind(p);
  else if (index === 1) args.fitName = p.expect('IDENT').value;
  else if (index === 2) args.relation = parseFitRelation(p);
  else if (index === 3) args.targetName = p.expect('IDENT').value;
  else if (index === 4) args.toleranceLevel = parseToleranceLevel(p);
  else {
    p.addError('fit() accepts at most 5 positional arguments', p.peek().span);
    p.advance();
  }
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
