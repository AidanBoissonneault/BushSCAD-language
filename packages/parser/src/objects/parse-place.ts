/**
 * @author Aidan Boissonneault
 * @file parse-place.ts
 * @purpose Parses place for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  FnCallExpr,
  PlaceStatement,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Parses component, function, and ref placement statements.
 *
 * `place(...)` supports both target-based placement and the origin-placement
 * overload. Keeping those forms together avoids diverging grammar behavior.
 */
export function parsePlace(p: Parser): PlaceStatement {
  const start = p.peek().span;
  p.advance(); // PLACE
  p.expect('LPAREN');
  const componentToken = p.expect('IDENT');
  const component = componentToken.value;
  let args: Expr[] = [];
  let namedArgs: FnCallExpr['namedArgs'] = [];
  if (p.check('LPAREN')) {
    const call = p.parseFnCallFromIdent({
      kind: 'IDENT',
      value: component,
      span: start,
    });
    args = call.args;
    namedArgs = call.namedArgs;
  }

  const target = p.eat('COMMA') ? p.parsePlacement() : null;
  const sourceAnchor =
    target !== null && p.eat('COMMA') ? p.parsePlacement() : null;
  p.expect('RPAREN');
  const rotate = parsePlacementRotation(p);
  const as = p.eat('AS') ? p.expect('IDENT').value : null;
  p.eatSemi();
  return {
    kind: 'place',
    component,
    nameSpan: componentToken.span,
    args,
    namedArgs,
    target,
    sourceAnchor,
    rotate,
    as,
    span: p.spanFrom(start),
  };
}

/**
 * Parses placement rotation from the supplied source into the objects representation.
 */
function parsePlacementRotation(p: Parser): PlaceStatement['rotate'] {
  const token = p.peek();
  if (token.kind === 'ROTATE') {
    p.advance();
    p.expect('LPAREN');
    const rotate = parseRotateCallArgs(p, token.span);
    p.expect('RPAREN');
    return rotate;
  }
  return parseAxisShortcutRotation(p, token);
}

/**
 * Parses axis shortcut rotation from the supplied source into the objects representation.
 */
function parseAxisShortcutRotation(
  p: Parser,
  token: ReturnType<Parser['peek']>,
): PlaceStatement['rotate'] {
  if (!isAxisShortcutRotation(p, token)) return null;
  p.advance();
  p.expect('LPAREN');
  const angle = p.parseExpr();
  p.expect('RPAREN');
  const axis = token.value.slice(-1).toLowerCase() as 'x' | 'y' | 'z';
  return {
    kind: 'axes',
    x: axis === 'x' ? angle : null,
    y: axis === 'y' ? angle : null,
    z: axis === 'z' ? angle : null,
    span: p.spanFrom(token.span),
  };
}

/**
 * Returns whether the input meets the `axis shortcut rotation` condition.
 */
function isAxisShortcutRotation(
  p: Parser,
  token: ReturnType<Parser['peek']>,
): token is ReturnType<Parser['peek']> & { kind: 'IDENT' } {
  return (
    token.kind === 'IDENT' &&
    (token.value === 'rotateX' ||
      token.value === 'rotateY' ||
      token.value === 'rotateZ') &&
    p.peek(1).kind === 'LPAREN'
  );
}

/**
 * Parses rotate call args from the supplied source into the objects representation.
 */
function parseRotateCallArgs(
  p: Parser,
  start: ASTSourceSpan,
): PlaceStatement['rotate'] {
  if (p.peek().kind === 'IDENT' && p.peek(1).kind === 'COLON') {
    const rotate: NonNullable<PlaceStatement['rotate']> = {
      kind: 'axes',
      x: null,
      y: null,
      z: null,
      span: start,
    };
    while (!p.check('RPAREN', 'EOF')) {
      const arg = p.parseNamedExprArg();
      if (!arg)
        p.fail('Expected rotate axis keyword x, y, or z', p.peek().span);
      const [name, value] = arg;
      if (name === 'x') rotate.x = value;
      else if (name === 'y') rotate.y = value;
      else if (name === 'z') rotate.z = value;
      else p.addError(`Unknown rotate axis '${name}'`, value.span);
      p.eat('COMMA');
    }
    return { ...rotate, span: p.spanFrom(start) };
  }

  const first = p.parseExpr();
  if (!p.eat('COMMA')) {
    return { kind: 'default', angle: first, span: p.spanFrom(start) };
  }

  const second = p.parseExpr();
  p.expect('COMMA');
  const third = p.parseExpr();
  return {
    kind: 'axes',
    x: first,
    y: second,
    z: third,
    span: p.spanFrom(start),
  };
}
