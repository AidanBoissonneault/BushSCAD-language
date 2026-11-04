import type { Expr, TransformOp } from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import { tryParseNamedCallArg } from '../../../expressions/parse-call-arguments.js';

/** Parses the single factor argument accepted by scale(). */
export function parseScaleOp(p: Parser): TransformOp {
  let factor: Expr | null = null;
  let supplied = false;
  while (!p.check('RPAREN', 'EOF')) {
    if (
      tryParseNamedCallArg(p, 'scale', {
        factor: (span) => {
          const value = p.parseExpr();
          if (supplied)
            p.addError("scale() got duplicate argument 'factor'", span);
          else factor = value;
          supplied = true;
        },
      })
    ) {
      // Named handler consumed the value.
    } else {
      const value = p.parseExpr();
      if (supplied)
        p.addError("scale() got duplicate argument 'factor'", value.span);
      else factor = value;
      supplied = true;
    }
    if (!p.eat('COMMA')) break;
  }
  if (!factor) {
    p.addError('scale() requires factor', p.peek().span);
    factor = { kind: 'number', value: 1, span: p.peek().span };
  }
  return { kind: 'scale', factor };
}
