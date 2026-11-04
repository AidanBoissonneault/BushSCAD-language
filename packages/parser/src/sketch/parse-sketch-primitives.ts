/**
 * @author Aidan Boissonneault
 * @file parse-sketch-primitives.ts
 * @purpose Dispatches sketch primitives to their feature-owned parsers.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parsePathSketch } from '../paths/parse-path-sketch.js';
import { parsePolygon } from './parse-sketch-polygon.js';
import { parseWord } from './parse-sketch-word.js';
import { parseWrapSketch } from '../geometry/parse-wrap-sketch.js';
import type { SketchExpressionParser } from './sketch-expression-parser.js';
import { parseRect } from './primitives/rect/parse-rect.js';
import { parseCircle } from './primitives/circle/parse-circle.js';
import { parseRoundRect } from './primitives/round-rect/parse-round-rect.js';
import { parseTriangle } from './primitives/triangle/parse-triangle.js';

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
