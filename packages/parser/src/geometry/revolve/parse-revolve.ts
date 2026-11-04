/** Parses the revolve geometry operation forms. */

import type { Expr, RevolveOp } from '@bushscad/ir';
import type { Parser } from '../../core/parser.js';
import { parseAxisRef } from '../../references/parse-axis-ref.js';
import { parseSketchInput } from '../../objects/parse-inputs.js';

/**
 * Parses a revolve object operation.
 * Revolve has its own axis grammar and optional named arguments, but it is
 * still a standard solid-producing object operation.
 */
export function parseRevolveOp(p: Parser): RevolveOp {
  const start = p.peek().span;
  p.advance(); // REVOLVE
  p.expect('LPAREN');
  const sketch = parseSketchInput(p);
  p.expect('COMMA');
  const angle = p.parseExpr();
  p.expect('AROUND');
  const around = parseAxisRef(p);
  let radius: Expr | undefined;
  while (p.eat('COMMA')) {
    if (p.check('RPAREN', 'EOF')) break;
    const named = p.parseNamedExprArg();
    const value = named?.[1] ?? p.parseExpr();
    const argName = named?.[0] ?? 'radius';
    if (argName === 'radius') {
      if (radius)
        p.addError("revolve() got duplicate argument 'radius'", value.span);
      else radius = value;
    } else {
      p.addError(`Unknown revolve argument '${argName}'`, value.span);
    }
  }
  p.expect('RPAREN');
  return {
    kind: 'revolve',
    sketch,
    angle,
    around,
    radius,
    span: p.spanFrom(start),
  };
}
