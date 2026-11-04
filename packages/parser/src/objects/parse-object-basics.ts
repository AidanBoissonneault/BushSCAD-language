/**
 * @author Aidan Boissonneault
 * @file parse-object-basics.ts
 * @purpose Parses object basics for the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { ExtrudeOp, RepeatableSpatialRef, ThickenOp } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseSketchInput, parseSurfaceInput } from './parse-inputs.js';
import { tryParseNamedDepth } from '../geometry/parse-cut.js';
import { placementRequestsWrap } from '../geometry/parse-wrap.js';

/**
 * Parses a basic extrude object operation.
 * Extrude is reused by visible objects, hidden refs, and inline solid-cut
 * tools, so its syntax must remain centralized.
 */
export function parseExtrudeOp(p: Parser): ExtrudeOp {
  const start = p.peek().span;
  p.advance(); // EXTRUDE
  p.expect('LPAREN');
  const sketch = parseSketchInput(p);
  p.expect('COMMA');
  const depth = tryParseNamedDepth(p) ?? p.parseExpr();
  const symmetric = !!p.eat('SYMMETRIC');
  let from: RepeatableSpatialRef | null = null;
  if (p.eat('COMMA')) from = p.parsePlacement();
  p.expect('RPAREN');
  return {
    kind: 'extrude',
    sketch,
    depth,
    from,
    symmetric,
    wrap: placementRequestsWrap(from),
    span: p.spanFrom(start),
  };
}

/**
 * Parses a surface-thickening object operation.
 * Thicken is a solid-producing operation and shares the object/ref operation
 * dispatch path with sketch-based operations.
 */
export function parseThickenOp(p: Parser): ThickenOp {
  const start = p.peek().span;
  p.advance(); // THICKEN
  p.expect('LPAREN');
  const surface = parseSurfaceInput(p);
  p.expect('COMMA');
  const thickness = p.parseExpr();
  p.expect('RPAREN');
  return { kind: 'thicken', surface, thickness, span: p.spanFrom(start) };
}

/** Parses the optional boolean wrap suffix for extrude and cut. */
export function parseWrapSuffix(p: Parser): boolean {
  if (!p.eat('WRAP')) return false;
  p.eat('COLON');
  const value = p.expect('BOOL', 'Expected true or false after wrap');
  return value.value === 'true';
}
