/**
 * @author Aidan Boissonneault
 * @file parse-solid-primitives.ts
 * @purpose Parses solid primitives for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  SolidPrimitiveArg,
  SolidPrimitiveName,
  SolidPrimitiveOp,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const SOLID_PRIMITIVE_NAMES = new Set<SolidPrimitiveName>([
  'cube',
  'cuboid',
  'sphere',
  'ellipsoid',
  'geodesicSphere',
  'cylinder',
  'cylinderElliptic',
  'cone',
  'frustum',
  'roundedCuboid',
  'roundedCylinder',
  'torus',
  'polyhedron',
]);

/**
 * Returns whether the input meets the `solid primitive name` condition.
 */
export function isSolidPrimitiveName(
  value: string,
): value is SolidPrimitiveName {
  return SOLID_PRIMITIVE_NAMES.has(value as SolidPrimitiveName);
}

/**
 * Returns whether the input meets the `solid primitive start` condition.
 */
export function isSolidPrimitiveStart(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    p.peek(1).kind === 'LPAREN' &&
    isSolidPrimitiveName(p.peek().value)
  );
}

/**
 * Parses a direct 3D primitive object operation.
 * Solid primitives are object-producing calls, not sketch expressions. Keeping
 * their parser separate prevents the generic function-call path from claiming
 * `obj body = cube(...)` before object operation dispatch can handle it.
 */
export function parseSolidPrimitiveOp(p: Parser): SolidPrimitiveOp {
  const start = p.peek().span;
  const primitiveToken = p.expect('IDENT');
  if (!isSolidPrimitiveName(primitiveToken.value)) {
    p.fail(
      `Unknown solid primitive '${primitiveToken.value}'`,
      primitiveToken.span,
    );
  }

  p.expect('LPAREN');
  const args: SolidPrimitiveArg[] = [];
  let placement: SolidPrimitiveOp['placement'] = null;
  while (!p.check('RPAREN', 'EOF')) {
    if (p.check('AT_SIGN')) {
      placement = p.parsePlacement();
    } else if (p.isNamedArgToken(p.peek()) && p.peek(1).kind === 'COLON') {
      const name = p.advance();
      p.expect('COLON');
      const value = p.parseExpr();
      args.push({ name: name.value, value, span: p.spanFrom(name.span) });
    } else {
      const value = p.parseExpr();
      args.push({ name: null, value, span: value.span });
    }

    if (!p.eat('COMMA')) break;
  }
  p.expect('RPAREN');

  return {
    kind: 'solidPrimitive',
    primitive: primitiveToken.value,
    args,
    placement,
    span: p.spanFrom(start),
  };
}
