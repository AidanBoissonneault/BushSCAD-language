/**
 * @author Aidan Boissonneault
 * @file parse-pattern-call.ts
 * @purpose Parses pattern call for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  PatternLinearStmt,
  PatternRadialStmt,
} from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import { tryParseNamedCallArg } from '../../expressions/parse-call-arguments.js';
import { parseObjectTargetName } from '../../expressions/parse-names.js';
import {
  finalizeLinearPattern,
  parseLinearPatternPositionalArg,
  parsePatternSpacing,
} from './linear/parse-linear-pattern.js';
import {
  finalizeRadialPattern,
  parsePatternAround,
  parseRadialPatternPositionalArg,
} from './radial/parse-radial-pattern.js';
import type { PatternCallArgs } from './types.js';

/**
 * Parses the call-style pattern syntax with positional defaults and named slots.
 * Pattern declarations combine object names, enum modes, numeric arguments, and
 * face references, so they need statement-specific normalization rather than
 * the expression-only optional-argument helper.
 */
export function parsePatternCallArgs(
  p: Parser,
  start: ASTSourceSpan,
): PatternLinearStmt | PatternRadialStmt {
  const args = defaultPatternCallArgs();
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParsePatternNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parsePatternPositionalArg(p, args);
    if (!p.eat('COMMA')) break;
  }
  return finalizePatternCall(p, args, start);
}

/**
 * Returns the default pattern call args used by this module.
 */
function defaultPatternCallArgs(): PatternCallArgs {
  return {
    target: null,
    mode: 'linear',
    modeProvided: false,
    supplied: new Set(),
    countX: null,
    countY: null,
    spacingX: null,
    spacingY: null,
    count: null,
    around: null,
  };
}

/**
 * Attempts to parse pattern named arg and reports whether it succeeds.
 */
function tryParsePatternNamedArg(p: Parser, args: PatternCallArgs): boolean {
  return tryParseNamedCallArg(p, 'pattern', {
    target: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'target',
        span,
        () => (args.target = parseObjectTargetName(p)),
      ),
    object: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'target',
        span,
        () => (args.target = parseObjectTargetName(p)),
      ),
    mode: (span) =>
      assignNamedPatternSlot(p, args, 'mode', span, () =>
        setPatternMode(args, parsePatternMode(p)),
      ),
    kind: (span) =>
      assignNamedPatternSlot(p, args, 'mode', span, () =>
        setPatternMode(args, parsePatternMode(p)),
      ),
    type: (span) =>
      assignNamedPatternSlot(p, args, 'mode', span, () =>
        setPatternMode(args, parsePatternMode(p)),
      ),
    x: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'countX',
        span,
        () => (args.countX = p.parseExpr()),
      ),
    countX: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'countX',
        span,
        () => (args.countX = p.parseExpr()),
      ),
    count_x: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'countX',
        span,
        () => (args.countX = p.parseExpr()),
      ),
    y: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'countY',
        span,
        () => (args.countY = p.parseExpr()),
      ),
    countY: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'countY',
        span,
        () => (args.countY = p.parseExpr()),
      ),
    count_y: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'countY',
        span,
        () => (args.countY = p.parseExpr()),
      ),
    count: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        args.mode === 'radial' ? 'count' : 'countX',
        span,
        () => parsePatternCount(p, args),
      ),
    spacing: (span) =>
      assignNamedPatternSlot(p, args, 'spacing', span, () =>
        parsePatternSpacing(p, args),
      ),
    spacingX: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'spacingX',
        span,
        () => (args.spacingX = p.parseExpr()),
      ),
    spacing_x: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'spacingX',
        span,
        () => (args.spacingX = p.parseExpr()),
      ),
    spacingY: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'spacingY',
        span,
        () => (args.spacingY = p.parseExpr()),
      ),
    spacing_y: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'spacingY',
        span,
        () => (args.spacingY = p.parseExpr()),
      ),
    around: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'around',
        span,
        () => (args.around = parsePatternAround(p)),
      ),
    axis: (span) =>
      assignNamedPatternSlot(
        p,
        args,
        'around',
        span,
        () => (args.around = parsePatternAround(p)),
      ),
  });
}

/** Assigns a named pattern value once and reports duplicate aliases. */
function assignNamedPatternSlot(
  p: Parser,
  args: PatternCallArgs,
  slot: string,
  span: ASTSourceSpan,
  assign: () => void,
): void {
  const spacingDuplicate =
    slot === 'spacing' &&
    (args.supplied.has('spacingX') || args.supplied.has('spacingY'));
  const duplicateSpacing =
    (slot === 'spacingX' || slot === 'spacingY') &&
    args.supplied.has('spacing');
  if (args.supplied.has(slot) || spacingDuplicate || duplicateSpacing) {
    p.addError(`pattern() got duplicate argument '${slot}'`, span);
    p.parseExpr();
    return;
  }
  args.supplied.add(slot);
  assign();
}

/**
 * Parses pattern count from the supplied source into the objects representation.
 */
function parsePatternCount(p: Parser, args: PatternCallArgs): void {
  if (args.mode === 'radial') args.count = p.parseExpr();
  else args.countX = p.parseExpr();
}

/** Records an explicitly selected linear or radial pattern form. */
function setPatternMode(
  args: PatternCallArgs,
  mode: 'linear' | 'radial',
): void {
  args.mode = mode;
  args.modeProvided = true;
  args.supplied.add('mode');
}

/**
 * Parses pattern positional arg from the supplied source into the objects representation.
 */
function parsePatternPositionalArg(p: Parser, args: PatternCallArgs): void {
  if (!args.target && !args.supplied.has('target')) {
    args.target = parseObjectTargetName(p);
    args.supplied.add('target');
    return;
  }
  if (!args.modeProvided && isPatternModeToken(p)) {
    setPatternMode(args, parsePatternMode(p));
    return;
  }
  if (args.mode === 'radial') parseRadialPatternPositionalArg(p, args);
  else parseLinearPatternPositionalArg(p, args);
}

/**
 * Parses pattern mode from the supplied source into the objects representation.
 */
function parsePatternMode(p: Parser): 'linear' | 'radial' {
  const tok = p.advance();
  if (tok.value === 'linear') return 'linear';
  if (tok.value === 'radial') return 'radial';
  p.addError(`Unknown pattern mode '${tok.value}'`, tok.span);
  return 'linear';
}

/**
 * Returns whether the input meets the `pattern mode token` condition.
 */
function isPatternModeToken(p: Parser): boolean {
  return p.peek().kind === 'LINEAR' || p.peek().kind === 'RADIAL';
}

/**
 * Handles finalize pattern call in the objects flow.
 */
function finalizePatternCall(
  p: Parser,
  args: PatternCallArgs,
  start: ASTSourceSpan,
): PatternLinearStmt | PatternRadialStmt {
  const target = args.target ?? '';
  if (!args.target) p.addError('pattern() requires target', p.spanFrom(start));
  if (args.mode === 'radial')
    return finalizeRadialPattern(p, args, start, target);
  return finalizeLinearPattern(p, args, start, target);
}

