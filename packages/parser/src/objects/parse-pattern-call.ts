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
import type { Parser } from '../core/parser.js';
import { tryParseNamedCallArg } from '../expressions/parse-call-arguments.js';
import { parseObjectTargetName } from '../expressions/parse-names.js';

/**
 * Pattern call args, including target, probe mode, mode from positional, count x, and count y.
 */
type PatternCallArgs = {
  target: string | null;
  mode: 'linear' | 'radial';
  modeFromPositional: boolean;
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
  let positional = 0;
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParsePatternNamedArg(p, args)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parsePatternPositionalArg(p, args, positional);
    positional++;
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
    modeFromPositional: false,
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
    target: () => (args.target = parseObjectTargetName(p)),
    object: () => (args.target = parseObjectTargetName(p)),
    mode: () => (args.mode = parsePatternMode(p)),
    kind: () => (args.mode = parsePatternMode(p)),
    type: () => (args.mode = parsePatternMode(p)),
    x: () => (args.countX = p.parseExpr()),
    countX: () => (args.countX = p.parseExpr()),
    count_x: () => (args.countX = p.parseExpr()),
    y: () => (args.countY = p.parseExpr()),
    countY: () => (args.countY = p.parseExpr()),
    count_y: () => (args.countY = p.parseExpr()),
    count: () => parsePatternCount(p, args),
    spacing: () => parsePatternSpacing(p, args),
    spacingX: () => (args.spacingX = p.parseExpr()),
    spacing_x: () => (args.spacingX = p.parseExpr()),
    spacingY: () => (args.spacingY = p.parseExpr()),
    spacing_y: () => (args.spacingY = p.parseExpr()),
    around: () => (args.around = parsePatternAround(p)),
    axis: () => (args.around = parsePatternAround(p)),
  });
}

/**
 * Parses pattern count from the supplied source into the objects representation.
 */
function parsePatternCount(p: Parser, args: PatternCallArgs): void {
  if (args.mode === 'radial') args.count = p.parseExpr();
  else args.countX = p.parseExpr();
}

/**
 * Parses pattern positional arg from the supplied source into the objects representation.
 */
function parsePatternPositionalArg(
  p: Parser,
  args: PatternCallArgs,
  index: number,
): void {
  if (index === 0) {
    args.target = parseObjectTargetName(p);
    return;
  }
  if (index === 1 && isPatternModeToken(p)) {
    args.mode = parsePatternMode(p);
    args.modeFromPositional = true;
    return;
  }
  if (args.mode === 'radial') parseRadialPatternPositionalArg(p, args, index);
  else parseLinearPatternPositionalArg(p, args, index);
}

/**
 * Parses linear pattern positional arg from the supplied source into the objects representation.
 */
function parseLinearPatternPositionalArg(
  p: Parser,
  args: PatternCallArgs,
  index: number,
): void {
  const slot = args.modeFromPositional ? index - 2 : index - 1;
  if (slot === 0) args.countX = p.parseExpr();
  else if (slot === 1) parsePatternSpacing(p, args);
  else if (slot === 2) args.countY = p.parseExpr();
  else {
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
  index: number,
): void {
  const slot = args.modeFromPositional ? index - 2 : index - 1;
  if (slot === 0) args.count = p.parseExpr();
  else if (slot === 1) args.around = parsePatternAround(p);
  else {
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
  } else {
    args.spacingX = expr;
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
