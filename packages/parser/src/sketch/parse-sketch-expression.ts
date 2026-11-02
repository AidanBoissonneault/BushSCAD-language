/**
 * @author Aidan Boissonneault
 * @file parse-sketch-expression.ts
 * @purpose Parses sketch expression for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parsePointTuple2 } from './parse-sketch-points.js';
import { parseSketchPrimitive } from './parse-sketch-primitives.js';
import {
  isAdvancedSketchCall,
  parseAdvancedSketchCall,
} from './parse-sketch-advanced.js';

/**
 * Parses a sketch expression with left-associative add/subtract composition.
 * Sketch declarations need `+`, `-`, and local `at (x, y)` placement without
 * leaking those operators into normal numeric expression parsing.
 */
export function parseSketchExpression(p: Parser): SketchPrimitive {
  let left = parseSketchTerm(p);

  while (p.check('PLUS', 'MINUS')) {
    const opToken = p.advance();
    const right = parseSketchTerm(p);
    left = {
      kind: 'sketchBoolean',
      op: opToken.kind === 'PLUS' ? 'add' : 'subtract',
      left,
      right,
      span: p.spanFrom(left.span),
    };
  }

  return left;
}

/**
 * Parses sketch term from the supplied source into the sketch representation.
 */
function parseSketchTerm(p: Parser): SketchPrimitive {
  let primitive = parseSketchPrimary(p);
  while (p.check('AT', 'AS')) {
    if (p.eat('AT')) {
      const start = primitive.span;
      const [x, y] = parsePointTuple2(p);
      primitive = {
        kind: 'sketchAt',
        primitive,
        x,
        y,
        span: p.spanFrom(start),
      };
      continue;
    }
    p.expect('AS');
    const name = p.expect('IDENT', 'Expected sketch component name after as');
    primitive = {
      kind: 'sketchAlias',
      name: name.value,
      nameSpan: name.span,
      primitive,
      span: p.spanFrom(primitive.span),
    };
  }
  return primitive;
}

/**
 * Parses sketch primary from the supplied source into the sketch representation.
 */
function parseSketchPrimary(p: Parser): SketchPrimitive {
  if (p.eat('LPAREN')) {
    const expr = parseSketchExpression(p);
    p.expect('RPAREN');
    return expr;
  }
  if (isAdvancedSketchCall(p)) {
    return parseAdvancedSketchCall(p, parseSketchExpression);
  }
  if (p.check('IDENT')) {
    const token = p.advance();
    return { kind: 'sketchRef', name: token.value, span: token.span };
  }
  return parseSketchPrimitive(p, parseSketchExpression);
}
