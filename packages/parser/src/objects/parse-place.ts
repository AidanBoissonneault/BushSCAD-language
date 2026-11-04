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
import { claimCallArgument } from '../expressions/parse-call-arguments.js';

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
  const args = defaultPlacementRotateArgs(start);
  while (!p.check('RPAREN', 'EOF')) {
    if (!parseNamedPlacementRotateArg(p, args))
      parsePositionalPlacementRotateArg(p, args);
    if (!p.eat('COMMA')) break;
  }
  return finalizePlacementRotateArgs(p, args, start);
}

type PlacementRotateArgs = {
  rotate: Extract<NonNullable<PlaceStatement['rotate']>, { kind: 'axes' }>;
  supplied: Set<'x' | 'y' | 'z'>;
  hasNamed: boolean;
  positionalCount: number;
};

/** Creates the empty positional/named rotation state for a placement call. */
function defaultPlacementRotateArgs(start: ASTSourceSpan): PlacementRotateArgs {
  return {
    rotate: { kind: 'axes', x: null, y: null, z: null, span: start },
    supplied: new Set(),
    hasNamed: false,
    positionalCount: 0,
  };
}

/** Parses one named axis value while preserving unfilled positional slots. */
function parseNamedPlacementRotateArg(
  p: Parser,
  args: PlacementRotateArgs,
): boolean {
  const named = p.parseNamedExprArg();
  if (!named) return false;
  args.hasNamed = true;
  const [name, value] = named;
  if (name !== 'x' && name !== 'y' && name !== 'z') {
    p.addError(`Unknown rotate axis '${name}'`, value.span);
  } else if (claimCallArgument(p, 'rotate', name, args.supplied, value.span)) {
    args.rotate[name] = value;
  }
  return true;
}

/** Fills the next free rotation axis from one positional expression. */
function parsePositionalPlacementRotateArg(
  p: Parser,
  args: PlacementRotateArgs,
): void {
  const value = p.parseExpr();
  const axis = (['x', 'y', 'z'] as const).find(
    (candidate) => !args.supplied.has(candidate),
  );
  if (axis) {
    args.rotate[axis] = value;
    args.supplied.add(axis);
  } else {
    p.addError('rotate() accepts at most 3 axis values', value.span);
  }
  args.positionalCount++;
}

/** Returns the single-angle or axis-vector placement rotation representation. */
function finalizePlacementRotateArgs(
  p: Parser,
  args: PlacementRotateArgs,
  start: ASTSourceSpan,
): PlaceStatement['rotate'] {
  if (args.supplied.size === 0)
    p.addError('rotate() requires an angle or axis value', p.spanFrom(start));
  if (!args.hasNamed && args.positionalCount === 1 && args.rotate.x) {
    return {
      kind: 'default',
      angle: args.rotate.x,
      span: p.spanFrom(start),
    };
  }
  if (!args.hasNamed && args.positionalCount === 2) {
    p.addError(
      'rotate() accepts one angle or three axis values',
      p.spanFrom(start),
    );
  }
  return { ...args.rotate, span: p.spanFrom(start) };
}
