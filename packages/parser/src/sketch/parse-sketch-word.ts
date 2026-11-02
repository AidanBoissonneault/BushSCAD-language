/**
 * @author Aidan Boissonneault
 * @file parse-sketch-word.ts
 * @purpose Parses sketch word for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  SketchOrigin,
  SketchPlacement,
  WordPrimitive,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import {
  isBareOriginToken,
  parseBareOrigin,
  parseOriginExpr,
} from './parse-sketch-origin.js';

/**
 * Parses the `word(...)` sketch primitive.
 * Text sketches accept mixed positional/named arguments and face placement, so
 * isolating that parsing keeps the primitive dispatcher focused.
 */
export function parseWord(p: Parser): WordPrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const text = p.parseExpr();
  const state: WordArgState = {
    size: { kind: 'number', value: 8, span: start },
    align: 'center',
  };

  while (p.eat('COMMA')) {
    if (p.check('RPAREN', 'EOF')) break;
    parseWordArg(p, state);
  }
  p.expect('RPAREN');
  return { kind: 'word', text, ...state, span: p.spanFrom(start) };
}

/**
 * State for word arg, including size, font, align, origin, and placement.
 */
type WordArgState = {
  size: Expr;
  font?: Expr;
  align: NonNullable<WordPrimitive['align']>;
  origin?: SketchOrigin;
  placement?: SketchPlacement;
};

/**
 * Parses word arg from the supplied source into the sketch representation.
 */
function parseWordArg(p: Parser, state: WordArgState): void {
  const arg = p.parseNamedExprArg();
  if (arg) {
    applyWordNamedArg(p, state, arg[0], arg[1]);
    return;
  }
  if (isBareOriginToken(p)) {
    state.origin = parseBareOrigin(p);
    return;
  }
  if (p.check('AT_SIGN')) {
    state.placement = { mode: 'on', face: p.parseSpatialRef() };
    return;
  }
  p.parseExpr();
}

/**
 * Applies word named arg to the supplied state or geometry.
 */
function applyWordNamedArg(
  p: Parser,
  state: WordArgState,
  argName: string,
  val: Expr,
): void {
  if (argName === 'size') state.size = val;
  else if (argName === 'font') state.font = val;
  else if (argName === 'origin') state.origin = parseOriginExpr(p, 'word', val);
  else if (argName === 'align') state.align = parseWordAlign(val, state.align);
}

/**
 * Parses word align from the supplied source into the sketch representation.
 */
function parseWordAlign(
  val: Expr,
  fallback: NonNullable<WordPrimitive['align']>,
): NonNullable<WordPrimitive['align']> {
  const value =
    val.kind === 'identifier'
      ? val.name
      : val.kind === 'string'
        ? val.value
        : '';
  return value === 'center' || value === 'left' || value === 'right'
    ? value
    : fallback;
}
