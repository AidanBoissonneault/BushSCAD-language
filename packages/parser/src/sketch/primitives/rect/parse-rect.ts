import type {
  ASTSourceSpan,
  Expr,
  InsetPrimitive,
  RectPrimitive,
} from '@bushscad/ir';
import type { Parser } from '../../../core/parser.js';
import { parseOrderedExprArgs } from '../../../expressions/parse-ordered-args.js';
import { parseRectSideNames } from '../../parse-rect-side-names.js';
import {
  isBareOriginToken,
  parseBareOrigin,
  parseOriginExpr,
  SKETCH_ORIGINS,
} from '../../parse-sketch-origin.js';
import { markCompactDimensionPlaceholders } from '../../parse-compact-sketch-dimensions.js';
import { parseTrailingSketchPlacement } from '../../placement/parse-trailing-sketch-placement.js';

/**
 * Parses rect from the supplied source into the sketch representation.
 */
export function parseRect(p: Parser): RectPrimitive | InsetPrimitive {
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
