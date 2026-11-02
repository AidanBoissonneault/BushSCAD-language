/**
 * @author Aidan Boissonneault
 * @file parse-sketch-dimensions.ts
 * @purpose Parses sketch dimensions for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  SketchDimensionAxis,
  SketchDimensionDecl,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { expectName } from '../expressions/parse-names.js';
import { parsePointTuple2 } from './parse-sketch-points.js';
import { parseOptionalDimensionName } from './parse-sketch-constraints.js';

/**
 * Parses a display-only sketch dimension declaration.
 * Reference dimensions are persistent editor annotations, but they must stay
 * separate from solver constraints so they never modify sketch geometry.
 */
export function parseDimensionDecl(p: Parser): SketchDimensionDecl {
  const start = p.advance().span;
  let target = expectName(p).value;
  let property = expectDimensionProperty(p, start);
  if (isEndpointProperty(property)) {
    target = `${target}.${property}`;
    property = expectDimensionProperty(p, start);
  }
  const dimension = dimensionKind(property, start, p);
  const ref = parseDimensionRef(p, dimension);
  const axis = parseDimensionAxis(p, dimension);
  const label = parseRequiredDimensionLabel(p);
  const name = parseOptionalDimensionName(p);
  return {
    kind: 'dimension',
    name,
    dimension,
    target,
    property,
    ref,
    axis,
    label,
    span: p.spanFrom(start),
  };
}

/**
 * Parses dimension axis from the supplied source into the sketch representation.
 */
function parseDimensionAxis(
  p: Parser,
  dimension: SketchDimensionDecl['dimension'],
): SketchDimensionAxis | undefined {
  if (p.peek().kind !== 'IDENT' || p.peek().value !== 'axis') return undefined;
  const span = p.advance().span;
  p.expect('COLON');
  const value = expectName(p).value;
  if (dimension !== 'distance') {
    p.addError('Only distance dimensions accept an axis option', span);
    return undefined;
  }
  if (value !== 'x' && value !== 'y') {
    p.addError("Distance axis must be 'x' or 'y'", span);
    return undefined;
  }
  return value;
}

/**
 * Parses dimension ref from the supplied source into the sketch representation.
 */
function parseDimensionRef(
  p: Parser,
  dimension: SketchDimensionDecl['dimension'],
): string | undefined {
  if (
    !['distance', 'angle'].includes(dimension) ||
    p.peek().kind !== 'IDENT' ||
    p.peek().value !== 'to'
  ) {
    return undefined;
  }
  p.advance();
  let name = expectName(p).value;
  if (p.eat('DOT')) name = `${name}.${expectName(p).value}`;
  return name;
}

/**
 * Asserts the expected dimension property behavior in this test.
 */
function expectDimensionProperty(
  p: Parser,
  fallbackSpan: ASTSourceSpan,
): string {
  p.expect('DOT');
  const token = expectName(p);
  return (
    token.value ||
    (p.addError('Expected dimension property', fallbackSpan), 'length')
  );
}

/**
 * Builds the dimension data required by the current drawing.
 */
function dimensionKind(
  property: string,
  span: ASTSourceSpan,
  p: Parser,
): SketchDimensionDecl['dimension'] {
  const dimensionalKinds: Record<string, SketchDimensionDecl['dimension']> = {
    length: 'length',
    distance: 'distance',
    angle: 'angle',
    radius: 'radius',
    diameter: 'diameter',
  };
  const kind = dimensionalKinds[property];
  if (!kind) p.addError(`Unknown dimension property '${property}'`, span);
  return kind ?? 'length';
}

/**
 * Parses required dimension label from the supplied source into the sketch representation.
 */
function parseRequiredDimensionLabel(p: Parser): [Expr, Expr] {
  p.expect('AT');
  return parsePointTuple2(p);
}

/**
 * Returns whether the input meets the `endpoint property` condition.
 */
function isEndpointProperty(property: string): boolean {
  return property === 'start' || property === 'end';
}
