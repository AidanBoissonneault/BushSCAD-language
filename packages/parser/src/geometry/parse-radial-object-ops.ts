/**
 * @author Aidan Boissonneault
 * @file parse-radial-object-ops.ts
 * @purpose Parses radial object ops for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  FaceRef,
  RadialCutOp,
  RadialExtent,
  RadialExtrudeOp,
  SketchInput,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseSketchInput } from '../objects/parse-inputs.js';
import { parseRadialArgs, type RadialArgs } from './parse-radial-args.js';

/**
 * Parses a radial extrude object operation.
 * Radial extrude and radial cut share the same argument grammar but emit
 * different operation kinds.
 */
export function parseRadialExtrudeOp(p: Parser): RadialExtrudeOp {
  const { start, sketch, args, extent } = parseRadialOperationHead(
    p,
    'radial_extrude',
  );
  return {
    kind: 'radial_extrude',
    sketch,
    axis: args.axis,
    extent,
    curve: args.curve,
    direction: args.direction,
    start: args.start,
    twist: args.twist,
    taper: args.taper,
    radius: args.radius,
    sections: args.sections,
    from: args.from,
    span: p.spanFrom(start),
  };
}

/**
 * Parses a radial cut object operation.
 * Radial cut uses the radial operation grammar while preserving its subtractive
 * operation kind for later evaluation.
 */
export function parseRadialCutOp(p: Parser): RadialCutOp {
  const { start, sketch, args, extent } = parseRadialOperationHead(
    p,
    'radial_cut',
  );
  return {
    kind: 'radial_cut',
    sketch,
    axis: args.axis,
    extent,
    curve: args.curve,
    direction: args.direction,
    start: args.start,
    twist: args.twist,
    taper: args.taper,
    radius: args.radius,
    sections: args.sections,
    from: args.from,
    span: p.spanFrom(start),
  };
}

/**
 * Parses the shared radial operation head and resolves the extent mode.
 * Radial operations infer multiple extent forms from the same named argument
 * set, and that validation must be identical for extrude and cut.
 */
function parseRadialOperationHead(
  p: Parser,
  opName: 'radial_extrude' | 'radial_cut',
): {
  start: ASTSourceSpan;
  sketch: SketchInput;
  args: RadialArgs;
  extent: RadialExtent;
} {
  const start = p.peek().span;
  p.advance();
  p.expect('LPAREN');
  const sketch = parseSketchInput(p);
  const args = parseRadialArgs(p, start);
  p.expect('RPAREN');

  const extent = resolveRadialExtent(p, args, start);
  if (!args.axis && !args.from && !args.to) {
    p.addError(
      `${opName} requires 'axis:' or an inferable 'from:' placement`,
      p.spanFrom(start),
    );
  }

  return { start, sketch, args, extent };
}

/**
 * Resolves radial extent using the geometry rules.
 */
function resolveRadialExtent(
  p: Parser,
  args: RadialArgs,
  startSpan: ASTSourceSpan,
): RadialExtent {
  if (radialExtentModeCount(args) > 1) {
    p.addError(
      `radial extent: use only one of 'angle:+length:', 'between:', or 'from:+to: optional along:'`,
      p.spanFrom(startSpan),
    );
  }
  if (hasPlacementBridgeExtent(args))
    return resolveBridgeExtent(p, args, startSpan);
  if (args.between !== null) {
    return { kind: 'between', a: args.between.a, b: args.between.b };
  }
  return resolveAngleLengthExtent(p, args, startSpan);
}

/**
 * Handles radial extent mode count in the geometry flow.
 */
function radialExtentModeCount(args: RadialArgs): number {
  return [
    args.angle !== null || args.length !== null,
    args.between !== null,
    hasPlacementBridgeExtent(args),
  ].filter(Boolean).length;
}

/**
 * Checks whether the input has placement bridge extent.
 */
function hasPlacementBridgeExtent(args: RadialArgs): boolean {
  return args.to !== null || args.along !== null;
}

/**
 * Resolves bridge extent using the geometry rules.
 */
function resolveBridgeExtent(
  p: Parser,
  args: RadialArgs,
  startSpan: ASTSourceSpan,
): RadialExtent {
  if (!args.from || !args.to) {
    p.addError(
      `radial placement bridge requires from: and to:`,
      p.spanFrom(startSpan),
    );
  }
  return {
    kind: 'placement-bridge',
    from: args.from ?? placeholderPlacement(startSpan),
    to: args.to ?? placeholderPlacement(startSpan),
    along: args.along,
  };
}

/**
 * Resolves angle length extent using the geometry rules.
 */
function resolveAngleLengthExtent(
  p: Parser,
  args: RadialArgs,
  startSpan: ASTSourceSpan,
): RadialExtent {
  if (args.angle === null || args.length === null) {
    p.addError(
      `radial extent: 'angle:' and 'length:' are both required (or use from:+to:+along:)`,
      p.spanFrom(startSpan),
    );
    const zero: Expr = { kind: 'number', value: 0, span: startSpan };
    return {
      kind: 'angle-length',
      angle: args.angle ?? zero,
      length: args.length ?? zero,
    };
  }
  return { kind: 'angle-length', angle: args.angle, length: args.length };
}

/**
 * Handles placeholder placement in the geometry flow.
 */
function placeholderPlacement(span: ASTSourceSpan): FaceRef {
  return {
    kind: 'faceRef',
    chain: [{ kind: 'name', value: 'missing', span }],
    span,
  };
}
