import type { ASTSourceSpan, Expr, PatternLinearStmt } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import type { PatternCallArgs } from '../types.js';

/** Fills linear pattern count and spacing slots from positional arguments. */
export function parseLinearPatternPositionalArg(
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

/** Parses scalar or tuple spacing into the linear pattern spacing slots. */
export function parsePatternSpacing(
  p: Parser,
  args: PatternCallArgs,
): void {
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

/** Validates required linear pattern slots and builds its IR statement. */
export function finalizeLinearPattern(
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

/** Creates the same zero-valued expression used for a missing numeric slot. */
function missingNumber(start: ASTSourceSpan): Expr {
  return { kind: 'number', value: 0, span: start };
}
