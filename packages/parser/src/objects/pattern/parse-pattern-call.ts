/**
 * @author Aidan Boissonneault
 * @file parse-pattern-call.ts
 * @purpose Parses pattern call for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  FaceRef,
  PatternLinearStmt,
  PatternRadialStmt,
} from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import { tryParseNamedCallArg } from '../../expressions/parse-call-arguments.js';
import { parseObjectTargetName } from '../../expressions/parse-names.js';

/**
 * Pattern call args, including target, probe mode, mode from positional, count x, and count y.
 */
type PatternCallArgs = {
  target: string | null;
  mode: 'linear' | 'radial';
  modeProvided: boolean;
  supplied: Set<string>;
  countX: Expr | null;
  countY: Expr | null;
  spacingX: Expr | null;
  spacingY: Expr | null;
  count: Expr | null;
  around: FaceRef | null;
};

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
 * Parses linear pattern positional arg from the supplied source into the objects representation.
 */
function parseLinearPatternPositionalArg(
  p: Parser,
  args: PatternCallArgs,
): void {
  if (!args.countX && !args.supplied.has('countX')) {
    args.countX = p.parseExpr();
    args.supplied.add('countX');
  } else if (!args.spacingX && !args.supplied.has('spacing')) {
    parsePatternSpacing(p, args);
    args.supplied.add('spacing');
  } else if (!args.countY && !args.supplied.has('countY')) {
    args.countY = p.parseExpr();
    args.supplied.add('countY');
  } else {
    const extra = p.parseExpr();
    p.addError('pattern(linear) accepts at most 3 value arguments', extra.span);
  }
}

/**
 * Parses radial pattern positional arg from the supplied source into the objects representation.
 */
function parseRadialPatternPositionalArg(
  p: Parser,
  args: PatternCallArgs,
): void {
  if (!args.count && !args.supplied.has('count')) {
    args.count = p.parseExpr();
    args.supplied.add('count');
  } else if (!args.around && !args.supplied.has('around')) {
    args.around = parsePatternAround(p);
    args.supplied.add('around');
  } else {
    const extra = p.parseExpr();
    p.addError('pattern(radial) accepts at most 2 value arguments', extra.span);
  }
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
 * Parses pattern spacing from the supplied source into the objects representation.
 */
function parsePatternSpacing(p: Parser, args: PatternCallArgs): void {
  const expr = p.parseExpr();
  if (expr.kind === 'tuple') {
    args.spacingX = expr.x;
    args.spacingY = expr.y;
    args.supplied.add('spacingX');
    args.supplied.add('spacingY');
  } else {
    args.spacingX = expr;
    args.supplied.add('spacingX');
  }
}

/**
 * Parses pattern around from the supplied source into the objects representation.
 */
function parsePatternAround(p: Parser): FaceRef {
  const firstTok = p.expect('IDENT');
  return p.parseFaceRefFromIdent(firstTok) as FaceRef;
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

/**
 * Handles finalize radial pattern in the objects flow.
 */
function finalizeRadialPattern(
  p: Parser,
  args: PatternCallArgs,
  start: ASTSourceSpan,
  target: string,
): PatternRadialStmt {
  if (!args.count) {
    args.count = args.countX;
    if (!args.count) {
      p.addError('pattern(radial) requires count', p.spanFrom(start));
      args.count = missingNumber(start);
    }
  }
  if (!args.around) {
    p.addError('pattern(radial) requires around', p.spanFrom(start));
    args.around = { kind: 'faceRef', chain: [], span: p.spanFrom(start) };
  }
  return {
    kind: 'patternRadial',
    target,
    count: args.count,
    around: args.around,
    span: p.spanFrom(start),
  };
}

/**
 * Handles finalize linear pattern in the objects flow.
 */
function finalizeLinearPattern(
  p: Parser,
  args: PatternCallArgs,
  start: ASTSourceSpan,
  target: string,
): PatternLinearStmt {
  if (!args.countX) {
    p.addError('pattern(linear) requires x count', p.spanFrom(start));
    args.countX = missingNumber(start);
  }
  if (!args.spacingX) {
    p.addError('pattern(linear) requires spacing', p.spanFrom(start));
    args.spacingX = missingNumber(start);
  }
  return {
    kind: 'patternLinear',
    target,
    countX: args.countX,
    countY: args.countY,
    spacingX: args.spacingX,
    spacingY: args.spacingY,
    span: p.spanFrom(start),
  };
}

/**
 * Handles missing number in the objects flow.
 */
function missingNumber(start: ASTSourceSpan): Expr {
  return { kind: 'number', value: 0, span: start };
}
