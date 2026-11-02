/**
 * @author Aidan Boissonneault
 * @file parse-inputs.ts
 * @purpose Parses inputs for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { ObjectInput, PathInput, SketchInput } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseSketchExpression } from '../sketch/parse-sketch-expression.js';
import { parsePathPrimitive } from '../paths/parse-paths.js';
import { parseSurfaceInput } from '../geometry/parse-surface.js';
import { expectName } from '../expressions/parse-names.js';

const SKETCH_STARTS = new Set([
  'LBRACE',
  'LPAREN',
  'RECT',
  'CIRCLE',
  'ROUNDRECT',
  'TRIANGLE',
  'POLYGON',
  'WORD',
]);

/**
 * Parses a sketch operand that may be a declared sketch name or an inline
 * sketch expression.
 * M41 makes `extrude(profile, 5)` and `extrude(rect(10, 10), 5)` equivalent
 * from the caller's point of view while preserving a typed AST boundary.
 */
export function parseSketchInput(p: Parser): SketchInput {
  const start = p.peek().span;
  if (SKETCH_STARTS.has(p.peek().kind)) {
    return {
      kind: 'inlineSketch',
      primitive: parseSketchExpression(p),
      span: p.spanFrom(start),
    };
  }
  if (p.check('LBRACKET')) return parseSketchInputList(p);
  const name = p.expect('IDENT');
  if (p.eat('DOT')) {
    const body = expectName(p, 'Expected sketch body name');
    return {
      kind: 'namedSketchBody',
      sketchName: name.value,
      bodyName: body.value,
      span: p.spanFrom(start),
    };
  }
  return { kind: 'namedSketch', name: name.value, span: name.span };
}

/**
 * Parses sketch input list from the supplied source into the objects representation.
 */
function parseSketchInputList(p: Parser): SketchInput {
  const start = p.peek().span;
  p.expect('LBRACKET');
  const items: SketchInput[] = [];
  while (!p.check('RBRACKET', 'EOF')) {
    items.push(parseSketchInput(p));
    p.eat('COMMA');
  }
  p.expect('RBRACKET');
  if (items.length === 0) {
    p.addError(
      'Sketch input arrays must contain at least one sketch',
      p.spanFrom(start),
    );
  }
  const bodyList = sketchBodyList(items, p.spanFrom(start));
  if (bodyList) return bodyList;
  return { kind: 'sketchList', items, span: p.spanFrom(start) };
}

/**
 * Handles sketch body list in the objects flow.
 */
function sketchBodyList(
  items: SketchInput[],
  span: import('@bushscad/ir').ASTSourceSpan,
): SketchInput | null {
  if (!items.every((item) => item.kind === 'namedSketchBody')) return null;
  const sketchName =
    items[0]?.kind === 'namedSketchBody' ? items[0].sketchName : null;
  if (!sketchName) return null;
  if (
    !items.every(
      (item) =>
        item.kind === 'namedSketchBody' && item.sketchName === sketchName,
    )
  ) {
    return null;
  }
  return {
    kind: 'sketchBodyList',
    sketchName,
    bodyNames: items.map((item) =>
      item.kind === 'namedSketchBody' ? item.bodyName : '',
    ),
    span,
  };
}

/**
 * Parses a path operand, accepting inline `polyline(...)` / `spline(...)`
 * primitives in places that historically required a path name.
 */
export function parsePathInput(p: Parser): PathInput {
  const start = p.peek().span;
  if (
    p.peek().kind === 'IDENT' &&
    (p.peek().value === 'polyline' || p.peek().value === 'spline') &&
    p.peek(1).kind === 'LPAREN'
  ) {
    return {
      kind: 'inlinePath',
      primitive: parsePathPrimitive(p),
      span: p.spanFrom(start),
    };
  }
  const name = expectName(p);
  return { kind: 'namedPath', name: name.value, span: name.span };
}

export { parseSurfaceInput };

/** Builds a named object operand from the current identifier token. */
export function parseNamedObjectInput(p: Parser): ObjectInput {
  const name = p.expect('IDENT');
  return { kind: 'namedObject', name: name.value, span: name.span };
}
