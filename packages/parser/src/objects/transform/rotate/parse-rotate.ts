import type { ASTSourceSpan, Expr, TransformOp } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import { tryParseNamedCallArg } from '../../../expressions/parse-call-arguments.js';
import { parseAxisRef } from '../../../references/parse-axis-ref.js';

/** Axis type for the rotate operation contract. */
type RotateAround = Extract<TransformOp, { kind: 'rotate' }>['around'];

/** State used while collecting rotate angle and axis values. */
type RotateState = {
  angle: Expr | null;
  around: RotateAround | null;
  supplied: Set<'angle' | 'around'>;
};

/** Parses positional and named angle/axis values for rotate(). */
export function parseRotateOp(p: Parser): TransformOp {
  const state: RotateState = {
    angle: null,
    around: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    if (tryParseRotateNamedArg(p, state)) {
      if (!p.eat('COMMA')) break;
      continue;
    }
    parseRotatePositionalArg(p, state);
    if (!p.eat('COMMA')) break;
  }
  return finalizeRotateOp(p, state);
}

/** Handles named angle, around, and axis aliases for rotate(). */
function tryParseRotateNamedArg(p: Parser, state: RotateState): boolean {
  return tryParseNamedCallArg(p, 'rotate', {
    angle: (span) => assignRotateArg(p, state, 'angle', p.parseExpr(), span),
    around: (span) =>
      assignRotateArg(p, state, 'around', parseAxisRef(p), span),
    axis: (span) => assignRotateArg(p, state, 'around', parseAxisRef(p), span),
  });
}

/** Stores a rotate slot once so later positional values fill only open slots. */
function assignRotateArg(
  p: Parser,
  state: RotateState,
  slot: 'angle' | 'around',
  value: Expr | RotateAround,
  span: ASTSourceSpan,
): void {
  if (state.supplied.has(slot)) {
    p.addError(`rotate() got duplicate argument '${slot}'`, span);
    return;
  }
  state.supplied.add(slot);
  if (slot === 'angle') state.angle = value as Expr;
  else state.around = value as RotateAround;
}

/** Parses the next positional rotate angle or axis value. */
function parseRotatePositionalArg(p: Parser, state: RotateState): void {
  if (!state.supplied.has('angle')) {
    const span = p.peek().span;
    const angle = p.parseExpr();
    assignRotateArg(p, state, 'angle', angle, span);
    if (p.eat('AROUND')) {
      const aroundSpan = p.peek().span;
      assignRotateArg(p, state, 'around', parseAxisRef(p), aroundSpan);
    }
  } else if (!state.supplied.has('around')) {
    const aroundSpan = p.peek().span;
    assignRotateArg(p, state, 'around', parseAxisRef(p), aroundSpan);
  } else {
    const extra = p.parseExpr();
    p.addError('rotate() accepts at most 2 positional arguments', extra.span);
  }
}

/** Supplies the historical angle/axis defaults while retaining diagnostics. */
function finalizeRotateOp(p: Parser, state: RotateState): TransformOp {
  if (!state.angle) {
    p.addError('rotate() requires angle', p.peek().span);
    state.angle = { kind: 'number', value: 0, span: p.peek().span };
  }
  if (!state.around) {
    p.addError('rotate() requires around axis', p.peek().span);
    state.around = 'z';
  }
  return { kind: 'rotate', angle: state.angle, around: state.around };
}
