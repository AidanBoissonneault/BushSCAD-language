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
    { name: 'bottom' },
    { name: 'right' },
    { name: 'top' },
    { name: 'left' },
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
  parseRectInsetArgs(p, result);
  p.expect('RPAREN');
  return { kind: 'inset', base: 'rect', ...result, span: p.spanFrom(start) };
}

/** Parses positional and labeled rectangle inset values in one argument order. */
function parseRectInsetArgs(
  p: Parser,
  result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>>,
): void {
  const positional: Expr[] = [];
  while (!p.check('RPAREN', 'EOF')) {
    const value = parseRectInsetArg(p, result);
    if (value) positional.push(value);
    if (!p.eat('COMMA')) break;
  }
  applyRectInsetPositionalArgs(p, result, positional);
}

/** Parses one named, contextual, placement, or positional inset argument. */
function parseRectInsetArg(
  p: Parser,
  result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>>,
): Expr | null {
  const named = p.parseNamedExprArg();
  if (named) {
    applyRectInsetNamedArg(p, result, named[0], named[1]);
    return null;
  }
  if (isBareOriginToken(p)) {
    const origin = parseBareOrigin(p);
    if (result.origin)
      p.addError("rect inset got duplicate argument 'origin'", p.peek().span);
    else result.origin = origin;
    return null;
  }
  if (p.check('AT_SIGN')) {
    const placement = { mode: 'on' as const, face: p.parseSpatialRef() };
    if (result.placement)
      p.addError(
        "rect inset got duplicate argument 'placement'",
        placement.face.span,
      );
    else result.placement = placement;
    return null;
  }
  return p.parseExpr();
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
  const name = argName === 'origin' ? 'origin' : argName;
  const existing = result[name as keyof typeof result];
  if (existing !== undefined) {
    p.addError(`rect inset got duplicate argument '${argName}'`, val.span);
    return;
  }
  if (name === 'x') result.x = val;
  else if (name === 'y') result.y = val;
  else if (name === 'top') result.top = val;
  else if (name === 'bottom') result.bottom = val;
  else if (name === 'sides') result.sides = val;
  else if (name === 'origin')
    result.origin = parseOriginExpr(p, 'rect inset', val);
  else p.addError(`rect inset does not accept argument '${argName}'`, val.span);
}

/** Assigns unlabelled inset values to the open slots in the active overload. */
function applyRectInsetPositionalArgs(
  p: Parser,
  result: Partial<Omit<InsetPrimitive, 'kind' | 'base' | 'span'>>,
  positional: Expr[],
): void {
  if (positional.length === 0) return;
  const hasPlanarSlots =
    result.x !== undefined || result.y !== undefined || positional.length > 1;
  if (!hasPlanarSlots && result.all === undefined) {
    result.all = positional[0];
    if (positional.length > 1) {
      p.addError(
        'rect inset accepts one uniform amount or separate side values',
        positional[1].span,
      );
    }
    return;
  }

  const slots = ['x', 'y', 'top', 'bottom', 'sides'] as const;
  for (const value of positional) {
    const slot = slots.find((candidate) => result[candidate] === undefined);
    if (!slot) {
      p.addError(
        'rect inset accepts at most five positional side values',
        value.span,
      );
      continue;
    }
    result[slot] = value;
  }
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
