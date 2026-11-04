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
    sizeProvided: false,
    alignProvided: false,
  };

  while (p.eat('COMMA')) {
    if (p.check('RPAREN', 'EOF')) break;
    parseWordArg(p, state);
  }
  p.expect('RPAREN');
  return {
    kind: 'word',
    text,
    size: state.size,
    font: state.font,
    align: state.align,
    origin: state.origin,
    placement: state.placement,
    span: p.spanFrom(start),
  };
}

/**
 * State for word arg, including size, font, align, origin, and placement.
 */
type WordArgState = {
  size: Expr;
  font?: Expr;
  align: NonNullable<WordPrimitive['align']>;
  sizeProvided: boolean;
  alignProvided: boolean;
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
  } else if (isBareOriginToken(p)) {
    parseWordOriginArg(p, state);
  } else if (p.check('AT_SIGN')) {
    parseWordPlacementArg(p, state);
  } else if (isBareWordAlign(p)) {
    assignWordAlign(
      p,
      state,
      p.advance().value as NonNullable<WordPrimitive['align']>,
      p.peek().span,
    );
  } else {
    parseWordPositionalArg(p, state);
  }
}

/** Fills size then font from one unlabeled word option. */
function parseWordPositionalArg(p: Parser, state: WordArgState): void {
  const value = p.parseExpr();
  if (!state.sizeProvided) {
    state.size = value;
    state.sizeProvided = true;
  } else if (!state.font) {
    state.font = value;
  } else {
    p.addError(
      'word() accepts text, optional size, font, alignment, origin, and placement',
      value.span,
    );
  }
}

/** Parses an optional bare center/corner origin once. */
function parseWordOriginArg(p: Parser, state: WordArgState): void {
  const span = p.peek().span;
  const origin = parseBareOrigin(p);
  if (state.origin) p.addError("word() got duplicate argument 'origin'", span);
  else state.origin = origin;
}

/** Parses an optional face placement once. */
function parseWordPlacementArg(p: Parser, state: WordArgState): void {
  const face = p.parseSpatialRef();
  if (state.placement)
    p.addError("word() got duplicate argument 'placement'", face.span);
  else state.placement = { mode: 'on', face };
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
  const parser = WORD_NAMED_ARG_PARSERS[argName];
  if (parser) parser(p, state, val);
  else p.addError(`word() does not accept argument '${argName}'`, val.span);
}

type WordNamedArgParser = (p: Parser, state: WordArgState, val: Expr) => void;

const WORD_NAMED_ARG_PARSERS: Readonly<Record<string, WordNamedArgParser>> = {
  size: (p, state, value) => assignWordSize(p, state, value),
  font: (p, state, value) => assignWordFont(p, state, value),
  origin: (p, state, value) => assignWordOrigin(p, state, value),
  align: (p, state, value) => assignWordAlignExpr(p, state, value),
};

/** Assigns the optional word size once. */
function assignWordSize(p: Parser, state: WordArgState, value: Expr): void {
  if (state.sizeProvided)
    p.addError("word() got duplicate argument 'size'", value.span);
  else {
    state.size = value;
    state.sizeProvided = true;
  }
}

/** Assigns the optional font expression once. */
function assignWordFont(p: Parser, state: WordArgState, value: Expr): void {
  if (state.font)
    p.addError("word() got duplicate argument 'font'", value.span);
  else state.font = value;
}

/** Assigns the optional origin expression once. */
function assignWordOrigin(p: Parser, state: WordArgState, value: Expr): void {
  if (state.origin)
    p.addError("word() got duplicate argument 'origin'", value.span);
  else state.origin = parseOriginExpr(p, 'word', value);
}

/** Validates and stores the optional labeled word alignment. */
function assignWordAlignExpr(
  p: Parser,
  state: WordArgState,
  value: Expr,
): void {
  assignWordAlign(p, state, parseWordAlign(p, value, state.align), value.span);
}

/** Stores one contextual or parsed word alignment and reports duplicates. */
function assignWordAlign(
  p: Parser,
  state: WordArgState,
  value: NonNullable<WordPrimitive['align']>,
  span: Expr['span'],
): void {
  if (state.alignProvided)
    p.addError("word() got duplicate argument 'align'", span);
  else {
    state.align = value;
    state.alignProvided = true;
  }
}

/** Recognizes the contextual alignment words accepted without a label. */
function isBareWordAlign(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    ['center', 'left', 'right'].includes(p.peek().value)
  );
}

/**
 * Parses word align from the supplied source into the sketch representation.
 */
function parseWordAlign(
  p: Parser,
  val: Expr,
  fallback: NonNullable<WordPrimitive['align']>,
): NonNullable<WordPrimitive['align']> {
  const value =
    val.kind === 'identifier'
      ? val.name
      : val.kind === 'string'
        ? val.value
        : '';
  if (value === 'center' || value === 'left' || value === 'right') return value;
  p.addError("word() align must be 'center', 'left', or 'right'", val.span);
  return fallback;
}
