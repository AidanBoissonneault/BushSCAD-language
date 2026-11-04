import type { Expr, TransformOp } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';

/** State used while collecting translate axis values. */
type TranslateState = {
  x: Expr | null;
  y: Expr | null;
  z: Expr | null;
  supplied: Set<'x' | 'y' | 'z'>;
};

/** Parses positional and named axis values for translate(). */
export function parseTranslateOp(p: Parser): TransformOp {
  const state: TranslateState = {
    x: null,
    y: null,
    z: null,
    supplied: new Set(),
  };
  while (!p.check('RPAREN', 'EOF')) {
    const named = parseTranslateNamedArg(p);
    if (named?.axis) {
      assignTranslateNamedArg(p, state, named);
    } else if (named) {
      // The named parser consumed and reported the invalid axis.
    } else {
      parseTranslatePositionalArg(p, state);
    }
    if (!p.eat('COMMA')) break;
  }
  return { kind: 'translate', x: state.x, y: state.y, z: state.z };
}

/** Assigns a named axis once and reports duplicate axis values. */
function assignTranslateNamedArg(
  p: Parser,
  state: TranslateState,
  named: { axis: 'x' | 'y' | 'z'; value: Expr; span: Expr['span'] },
): void {
  if (state.supplied.has(named.axis)) {
    p.addError(
      `translate() got duplicate argument '${named.axis}'`,
      named.span,
    );
    return;
  }
  state[named.axis] = named.value;
  state.supplied.add(named.axis);
}

/** Fills the next unused axis from the positional argument list. */
function parseTranslatePositionalArg(p: Parser, state: TranslateState): void {
  const axis = (['x', 'y', 'z'] as const).find(
    (candidate) => !state.supplied.has(candidate),
  );
  if (!axis) {
    const extra = p.parseExpr();
    p.addError(
      'translate() accepts at most 3 positional arguments',
      extra.span,
    );
    return;
  }
  state[axis] = p.parseExpr();
  state.supplied.add(axis);
}

/** Parses and validates one named translate axis. */
function parseTranslateNamedArg(
  p: Parser,
):
  | { axis: 'x' | 'y' | 'z'; value: Expr; span: Expr['span'] }
  | { axis: null }
  | null {
  if (!p.isNamedArgToken(p.peek()) || p.peek(1).kind !== 'COLON') return null;
  const axisToken = p.advance();
  p.advance(); // COLON
  const axis = axisToken.value;
  const value = p.parseExpr();
  if (axis === 'x' || axis === 'y' || axis === 'z') {
    return { axis, value, span: axisToken.span };
  }
  p.addError(`Unknown translate axis '${axis}'`, axisToken.span);
  return { axis: null };
}
