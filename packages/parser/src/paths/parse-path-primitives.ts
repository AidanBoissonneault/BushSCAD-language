/**
 * @author Aidan Boissonneault
 * @file parse-path-primitives.ts
 * @purpose Parses path primitives for the paths in parser package.
 * @last-edited October 6, 2026
 */

import type {
  PathEmbeddedPrimitive,
  PathPrimitiveItem,
  SketchPrimitive,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { SketchExpressionParser } from '../sketch/sketch-expression-parser.js';

/** Returns whether the next path entry starts a supported compact primitive. */
export function isPathPrimitiveStart(p: Parser): boolean {
  const offset = isConstructionToken(p, 0) ? 1 : 0;
  return isCompactPrimitiveToken(p, offset);
}

/**
 * Parses one compact rectangle or circle, including local `at (...)` wrappers.
 * Mixed paths retain construction curves around editor primitives, but must not
 * admit arbitrary sketch Boolean algebra that cannot lower to one flat profile.
 */
export function parsePathPrimitiveItem(
  p: Parser,
  parseExpression: SketchExpressionParser,
): PathPrimitiveItem {
  const construction = isConstructionToken(p, 0);
  if (construction) p.advance();
  const primitive = parseExpression(p);
  const embedded = pathEmbeddedPrimitive(primitive);
  if (!embedded) {
    p.addError(
      'path() compact entries must be one rect(...), circle(...), or ellipse(...), optionally followed by at (x, y).',
      primitive.span,
    );
  }
  return {
    kind: 'primitive',
    construction,
    primitive: embedded ?? firstCompactPrimitive(primitive),
    span: primitive.span,
  };
}

/**
 * Returns whether the input meets the `construction token` condition.
 */
function isConstructionToken(p: Parser, offset: number): boolean {
  return (
    p.peek(offset).kind === 'IDENT' && p.peek(offset).value === 'construction'
  );
}

/**
 * Returns whether the input meets the `compact primitive token` condition.
 */
function isCompactPrimitiveToken(p: Parser, offset: number): boolean {
  const token = p.peek(offset);
  return (
    token.kind === 'RECT' ||
    token.kind === 'CIRCLE' ||
    (token.kind === 'IDENT' &&
      token.value === 'ellipse' &&
      p.peek(offset + 1).kind === 'LPAREN')
  );
}

/**
 * Builds the path data required by the current operation.
 */
function pathEmbeddedPrimitive(
  primitive: SketchPrimitive,
): PathEmbeddedPrimitive | null {
  if (
    primitive.kind === 'rect' ||
    primitive.kind === 'circle' ||
    primitive.kind === 'ellipse'
  ) {
    return primitive;
  }
  if (primitive.kind !== 'sketchAt') return null;
  const nested = pathEmbeddedPrimitive(primitive.primitive);
  return nested ? { ...primitive, primitive: nested } : null;
}

/**
 * Returns the first compact primitive that matches the requested condition.
 */
function firstCompactPrimitive(
  primitive: SketchPrimitive,
): PathEmbeddedPrimitive {
  if (
    primitive.kind === 'rect' ||
    primitive.kind === 'circle' ||
    primitive.kind === 'ellipse'
  ) {
    return primitive;
  }
  if (primitive.kind === 'sketchAt') {
    return {
      ...primitive,
      primitive: firstCompactPrimitive(primitive.primitive),
    };
  }
  if (primitive.kind === 'sketchBoolean') {
    return firstCompactPrimitive(primitive.left);
  }
  throw new Error(
    'Compact path parsing did not start with rect, circle, or ellipse',
  );
}
