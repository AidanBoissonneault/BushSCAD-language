/**
 * @author Aidan Boissonneault
 * @file parse-wrap-sketch.ts
 * @purpose Parses wrap sketch for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr, WrapMode, WrapSketchPrimitive } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const WRAP_MODES = ['ordered', 'convex', 'concave', 'smooth'] as const;

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
    options.push({ name: named[0], value: named[1] });
    return 'ordered';
  }

  const token = p.advance();
  const mode = WRAP_MODES.find((candidate) => candidate === token.value);
  if (!mode) {
    p.addError(
      `Unknown wrap mode '${token.value}'. Expected ordered, convex, concave, or smooth.`,
      token.span,
    );
    return 'ordered';
  }
  return mode;
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
    const expr = p.parseExpr();
    p.addError('wrap() options must use keyword arguments.', expr.span);
    return;
  }
  options.push({ name: named[0], value: named[1] });
}
