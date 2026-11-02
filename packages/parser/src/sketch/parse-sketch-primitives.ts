/**
 * @author Aidan Boissonneault
 * @file parse-sketch-primitives.ts
 * @purpose Parses sketch primitives for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  CirclePrimitive,
  Expr,
  InsetPrimitive,
  RectPrimitive,
  RoundRectPrimitive,
  SketchPrimitive,
  SketchPlacement,
  TrianglePrimitive,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseOrderedExprArgs } from '../expressions/parse-ordered-args.js';
import { parsePathSketch } from '../paths/parse-path-sketch.js';
import { parsePolygon } from './parse-sketch-polygon.js';
import { parseRectSideNames } from './parse-rect-side-names.js';
import {
  isBareOriginToken,
  parseBareOrigin,
  parseOriginExpr,
  SKETCH_ORIGINS,
} from './parse-sketch-origin.js';
import { parseWord } from './parse-sketch-word.js';
import { parseWrapSketch } from '../geometry/parse-wrap-sketch.js';
import type { SketchExpressionParser } from './sketch-expression-parser.js';
import { markCompactDimensionPlaceholders } from './parse-compact-sketch-dimensions.js';

/**
 * Parses trailing sketch placement from the supplied source into the sketch representation.
 */
function parseTrailingSketchPlacement(p: Parser): SketchPlacement | undefined {
  if (!p.eat('COMMA')) return undefined;
  if (!p.check('AT_SIGN')) {
    p.addError(
      `Sketch placement must use an @ spatial reference`,
      p.peek().span,
    );
    return undefined;
  }
  return { mode: 'on', face: p.parseSpatialRef() };
}

/**
 * Parses one concrete sketch primitive from the current token.
 * Primitive dispatch is shared by sketch expressions, while recursive path
 * members use the supplied expression parser without creating module cycles.
 */
export function parseSketchPrimitive(
  p: Parser,
  parseExpression: SketchExpressionParser,
): SketchPrimitive {
  const t = p.peek();
  switch (t.kind) {
    case 'PATH':
      return parsePathSketch(p, parseExpression);
    case 'WRAP':
      return parseWrapSketch(p);
    case 'RECT':
      return parseRect(p);
    case 'CIRCLE':
      return parseCircle(p);
    case 'ROUNDRECT':
      return parseRoundRect(p);
    case 'TRIANGLE':
      return parseTriangle(p);
    case 'POLYGON':
      return parsePolygon(p);
    case 'WORD':
      return parseWord(p);
    case 'LBRACE':
      return p.fail(
        'Block-style sketch profiles are no longer supported; use path(...).',
        t.span,
      );
    default:
      p.fail(`Expected sketch primitive, got ${t.kind}`, t.span);
  }
}

/**
 * Parses rect from the supplied source into the sketch representation.
 */
function parseRect(p: Parser): RectPrimitive | InsetPrimitive {
  const start = p.advance().span;
  if (p.check('INSET')) return parseRectInset(p, start);
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'rect', [
    { name: 'width', required: true },
    { name: 'height', required: true },
    { name: 'cornerRadius', aliases: ['r', 'radius'] },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
    { name: 'bottom', positional: false },
    { name: 'right', positional: false },
    { name: 'top', positional: false },
    { name: 'left', positional: false },
  ]);
  const sideNames = parseRectSideNames(p, args);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  const primitive: RectPrimitive = {
    kind: 'rect',
    width: args.width!,
    height: args.height!,
    cornerRadius: args.cornerRadius,
    ...(sideNames ? { sideNames } : {}),
    origin: parseOriginExpr(p, 'rect', args.origin),
    placement,
    span: p.spanFrom(start),
  };
  markCompactDimensionPlaceholders(primitive, {
    width: primitive.width,
    height: primitive.height,
  });
  return primitive;
}

/**
 * Parses rect inset from the supplied source into the sketch representation.
 */
function parseRectInset(p: Parser, start: ASTSourceSpan): InsetPrimitive {
  p.expect('INSET');
  p.expect('LPAREN');
  const result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>> = {};

  if (p.peek().kind === 'IDENT' && p.peek(1).kind === 'COLON') {
    parseRectInsetNamedArgs(p, result);
  } else {
    parseRectInsetPositionalArgs(p, result);
  }
  const placement = parseTrailingSketchPlacement(p);
  if (placement) result.placement = placement;
  p.expect('RPAREN');
  return { kind: 'inset', base: 'rect', ...result, span: p.spanFrom(start) };
}

/**
 * Parses rect inset named args from the supplied source into the sketch representation.
 */
function parseRectInsetNamedArgs(
  p: Parser,
  result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>>,
): void {
  while (!p.check('RPAREN', 'EOF')) {
    const argName = p.advance().value;
    p.expect('COLON');
    applyRectInsetNamedArg(p, result, argName, p.parseExpr());
    p.eat('COMMA');
  }
}

/**
 * Applies rect inset named arg to the supplied state or geometry.
 */
function applyRectInsetNamedArg(
  p: Parser,
  result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>>,
  argName: string,
  val: Expr,
): void {
  if (argName === 'x') result.x = val;
  else if (argName === 'y') result.y = val;
  else if (argName === 'top') result.top = val;
  else if (argName === 'bottom') result.bottom = val;
  else if (argName === 'sides') result.sides = val;
  else if (argName === 'origin')
    result.origin = parseOriginExpr(p, 'rect inset', val);
}

/**
 * Parses rect inset positional args from the supplied source into the sketch representation.
 */
function parseRectInsetPositionalArgs(
  p: Parser,
  result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>>,
): void {
  const first = p.parseExpr();
  if (!p.eat('COMMA')) {
    result.all = first;
    return;
  }
  if (p.check('AT_SIGN')) {
    result.all = first;
    result.placement = { mode: 'on', face: p.parseSpatialRef() };
    return;
  }
  if (isBareOriginToken(p)) {
    result.all = first;
    result.origin = parseBareOrigin(p);
    return;
  }
  result.x = first;
  result.y = p.parseExpr();
}

/**
 * Parses circle from the supplied source into the sketch representation.
 */
function parseCircle(p: Parser): CirclePrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'circle', [
    { name: 'diameter', aliases: ['d'], required: true },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
  ]);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  const primitive: CirclePrimitive = {
    kind: 'circle',
    diameter: args.diameter!,
    origin: parseOriginExpr(p, 'circle', args.origin),
    placement,
    span: p.spanFrom(start),
  };
  markCompactDimensionPlaceholders(primitive, {
    diameter: primitive.diameter,
  });
  return primitive;
}

/**
 * Parses round rect from the supplied source into the sketch representation.
 */
function parseRoundRect(p: Parser): RoundRectPrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'roundrect', [
    { name: 'width', required: true },
    { name: 'height', required: true },
    { name: 'radius', aliases: ['r'], required: true },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
  ]);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  const primitive: RoundRectPrimitive = {
    kind: 'roundrect',
    width: args.width!,
    height: args.height!,
    radius: args.radius!,
    origin: parseOriginExpr(p, 'roundrect', args.origin),
    placement,
    span: p.spanFrom(start),
  };
  markCompactDimensionPlaceholders(primitive, {
    width: primitive.width,
    height: primitive.height,
    radius: primitive.radius,
  });
  return primitive;
}

/**
 * Parses triangle from the supplied source into the sketch representation.
 */
function parseTriangle(p: Parser): TrianglePrimitive {
  const start = p.advance().span;
  p.expect('LPAREN');
  const args = parseOrderedExprArgs(p, 'triangle', [
    { name: 'base', required: true },
    { name: 'height', required: true },
    { name: 'origin', positional: false, enumValues: SKETCH_ORIGINS },
  ]);
  const placement = parseTrailingSketchPlacement(p);
  p.expect('RPAREN');
  return {
    kind: 'triangle',
    base: args.base!,
    height: args.height!,
    origin: parseOriginExpr(p, 'triangle', args.origin),
    placement,
    span: p.spanFrom(start),
  };
}
