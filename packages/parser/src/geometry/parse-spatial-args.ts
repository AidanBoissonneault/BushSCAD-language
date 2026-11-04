/**
 * @author Aidan Boissonneault
 * @file parse-spatial-args.ts
 * @purpose Parses spatial args for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type { Expr, FaceRef, PosRef } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseOrderedExprArgs } from '../expressions/parse-ordered-args.js';

/**
 * Spatial args, including x, y, radius, angle, and offset.
 */
type SpatialArgs = {
  x?: Expr;
  y?: Expr;
  radius?: Expr;
  angle?: Expr;
  offset?: Expr;
  surfaceAngle?: Expr;
  wrap?: boolean;
};

/**
 * Parses arguments attached to an `@` spatial reference.
 * Spatial references support both planar offsets and polar offsets. Keeping
 * that overload decision here lets `parse-refs` stay focused on reference
 * chains while this module owns value-slot interpretation.
 */
export function parseSpatialArgs(
  p: Parser,
  segmentName: string,
  face: FaceRef,
): SpatialArgs {
  if (segmentName === 'curved') return parseCurvedArgs(p);
  if (p.check('WRAP')) return parseWrapOnlyArgs(p);
  if (isCenterRef(face)) return parseCenterSpatialArgs(p);
  return parsePlanarSpatialArgs(p);
}

/**
 * Parses planar spatial args from the supplied source into the geometry representation.
 */
function parsePlanarSpatialArgs(p: Parser): SpatialArgs {
  return parseOrderedExprArgs(p, 'spatial reference', [
    { name: 'x' },
    { name: 'y' },
    { name: 'radius' },
    { name: 'angle' },
    { name: 'offset' },
    { name: 'surfaceAngle' },
  ]);
}

/**
 * Parses center-anchor offsets, where two bare values are local x/y offsets.
 * The unified reference model treats every callable spatial reference as a
 * local offset. Polar placement remains available through named radius/angle
 * arguments without making `.center(...)` a special positional case.
 */
function parseCenterSpatialArgs(p: Parser): SpatialArgs {
  return parseOrderedExprArgs(p, 'spatial reference', [
    { name: 'x' },
    { name: 'y' },
    { name: 'radius' },
    { name: 'angle' },
    { name: 'offset' },
    { name: 'surfaceAngle' },
  ]);
}

/**
 * Parses wrap only args from the supplied source into the geometry representation.
 */
function parseWrapOnlyArgs(p: Parser): SpatialArgs {
  p.expect('WRAP');
  return { wrap: true };
}

/**
 * Parses cylindrical face placement arguments like `curved(45deg, wrap)`.
 * Curved placements use their positional value as a surface angle, unlike
 * planar spatial calls where the first two positional values are x/y offsets.
 */
function parseCurvedArgs(p: Parser): SpatialArgs {
  const args: SpatialArgs = {};
  while (!p.check('RPAREN', 'EOF')) {
    const wrapToken = p.eat('WRAP');
    if (wrapToken) {
      if (args.wrap)
        p.addError("curved() got duplicate argument 'wrap'", wrapToken.span);
      args.wrap = true;
    } else if (p.peek().kind === 'IDENT' && p.peek(1).kind === 'COLON') {
      parseCurvedNamedArg(p, args);
    } else if (!args.surfaceAngle) {
      args.surfaceAngle = p.parseExpr();
    } else {
      const extra = p.parseExpr();
      p.addError(
        'curved() accepts one surface angle and optional wrap flag',
        extra.span,
      );
    }
    if (!p.eat('COMMA')) break;
  }
  return args;
}

/**
 * Parses curved named arg from the supplied source into the geometry representation.
 */
function parseCurvedNamedArg(p: Parser, args: SpatialArgs): void {
  const name = p.advance();
  p.expect('COLON');
  if (name.value === 'surfaceAngle' || name.value === 'angle') {
    if (args.surfaceAngle) {
      p.addError("curved() got duplicate argument 'surfaceAngle'", name.span);
      p.parseExpr();
    } else args.surfaceAngle = p.parseExpr();
    return;
  }
  p.addError(`curved() does not accept argument '${name.value}'`, name.span);
  p.parseExpr();
}

/**
 * Lowers parsed spatial arguments into the existing placement AST shapes.
 * Evaluator placement logic already understands `FaceRef` plus `PosRef`; this
 * keeps the new overload behavior parser-local and behavior preserving after
 * the AST is produced.
 */
export function spatialArgsToRef(
  face: FaceRef,
  args: SpatialArgs,
  span: FaceRef['span'],
): FaceRef | PosRef {
  if (args.surfaceAngle) face.surfaceAngle = args.surfaceAngle;
  if (args.wrap) face.wrap = true;
  const hasOffset =
    args.x !== undefined ||
    args.y !== undefined ||
    args.radius !== undefined ||
    args.angle !== undefined ||
    args.offset !== undefined;
  if (!hasOffset) return face;
  return {
    kind: 'pos',
    anchor: face,
    x: args.x,
    y: args.y,
    radius: args.radius,
    angle: args.angle,
    offset: args.offset,
    span,
  };
}

/**
 * Returns whether the input meets the `center ref` condition.
 */
function isCenterRef(face: FaceRef): boolean {
  const last = face.chain.at(-1);
  if (last?.kind === 'name' && last.value === 'center') return true;
  const first = face.chain[0];
  return first?.kind === 'name' && first.value.endsWith('_center');
}
