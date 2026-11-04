import type { ASTSourceSpan, Expr, FaceRef, PatternRadialStmt } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import type { PatternCallArgs } from '../types.js';

/** Fills radial pattern count and around slots from positional arguments. */
export function parseRadialPatternPositionalArg(
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

/** Parses the face reference used as the radial pattern axis. */
export function parsePatternAround(p: Parser): FaceRef {
  const firstToken = p.expect('IDENT');
  return p.parseFaceRefFromIdent(firstToken) as FaceRef;
}

/** Validates required radial pattern slots and builds its IR statement. */
export function finalizeRadialPattern(
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

/** Creates the same zero-valued expression used for a missing numeric slot. */
function missingNumber(start: ASTSourceSpan): Expr {
  return { kind: 'number', value: 0, span: start };
}
