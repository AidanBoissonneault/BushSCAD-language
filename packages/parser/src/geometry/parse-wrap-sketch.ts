/**
 * @author Aidan Boissonneault
 * @file parse-wrap-sketch.ts
 * @purpose Parses wrap sketch for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr, WrapMode, WrapSketchPrimitive } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const WRAP_MODES = ['ordered', 'convex', 'concave', 'smooth'] as const;
const WRAP_POSITIONAL_OPTIONS = ['rounded', 'tension', 'tolerance'] as const;

/**
 * Parses `wrap(points, intent?, options?)` as a sketch constructor.
 * The intent argument is a contextual bare word, not a variable reference, so
 * it needs dedicated parsing before regular expression resolution runs.
 */
export function parseWrapSketch(p: Parser): WrapSketchPrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const points = p.parseExpr();
  let mode: WrapMode = 'ordered';
  const options: { name: string; value: Expr }[] = [];

  if (p.eat('COMMA') && !p.check('RPAREN', 'EOF')) {
    mode = parseWrapModeOrOption(p, options);
  }
  while (p.eat('COMMA')) {
    if (p.check('RPAREN', 'EOF')) break;
    parseWrapOption(p, options);
  }

  p.expect('RPAREN');
  return { kind: 'wrapSketch', points, mode, options, span: p.spanFrom(start) };
}

/**
 * Parses wrap mode or option from the supplied source into the geometry representation.
 */
function parseWrapModeOrOption(
  p: Parser,
  options: { name: string; value: Expr }[],
): WrapMode {
  const named = p.parseNamedExprArg();
  if (named) {
    addNamedWrapOption(p, options, named[0], named[1]);
    return 'ordered';
  }

  const modeToken = p.peek();
  const mode = WRAP_MODES.find((candidate) => candidate === modeToken.value);
  if (mode) {
    p.advance();
    return mode;
  }
  if (modeToken.kind === 'IDENT') {
    p.addError(
      `Unknown wrap mode '${modeToken.value}'. Expected ordered, convex, concave, or smooth.`,
      modeToken.span,
    );
    p.advance();
    return 'ordered';
  }
  addPositionalWrapOption(p, options);
  return 'ordered';
}

/**
 * Parses wrap option from the supplied source into the geometry representation.
 */
function parseWrapOption(
  p: Parser,
  options: { name: string; value: Expr }[],
): void {
  const named = p.parseNamedExprArg();
  if (!named) {
    addPositionalWrapOption(p, options);
    return;
  }
  addNamedWrapOption(p, options, named[0], named[1]);
}

/** Validates a labeled wrap option and stores it once. */
function addNamedWrapOption(
  p: Parser,
  options: { name: string; value: Expr }[],
  name: string,
  value: Expr,
): void {
  if (
    !WRAP_POSITIONAL_OPTIONS.includes(
      name as (typeof WRAP_POSITIONAL_OPTIONS)[number],
    )
  ) {
    p.addError(
      `wrap() does not accept option '${name}'. Expected rounded, tension, or tolerance.`,
      value.span,
    );
    return;
  }
  if (options.some((option) => option.name === name)) {
    p.addError(`wrap() got duplicate argument '${name}'`, value.span);
    return;
  }
  options.push({ name, value });
}

/** Assigns a positional option to its documented slot order. */
function addPositionalWrapOption(
  p: Parser,
  options: { name: string; value: Expr }[],
): void {
  const value = p.parseExpr();
  const name = WRAP_POSITIONAL_OPTIONS.find(
    (candidate) => !options.some((option) => option.name === candidate),
  );
  if (!name) {
    p.addError(
      'wrap() accepts rounded, tension, and tolerance options',
      value.span,
    );
    return;
  }
  options.push({ name, value });
}
