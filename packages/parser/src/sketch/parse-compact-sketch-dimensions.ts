/**
 * @author Aidan Boissonneault
 * @file parse-compact-sketch-dimensions.ts
 * @purpose Parses compact sketch dimensions for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CompactSketchDimensionDecl,
  CompactSketchParameter,
  CompactDimensionPrimitive,
  Expr,
  SketchPrimitive,
} from '@bushscad/ir';
import {
  compactDimensionPrimitiveOwnsReference,
  compactDimensionPrimitives,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/** Marks `_` expressions in supported primitive scalar slots for later binding. */
export function markCompactDimensionPlaceholders(
  primitive: CompactDimensionPrimitive,
  fields: Partial<Record<CompactSketchParameter, Expr>>,
): void {
  for (const [field, expression] of Object.entries(fields)) {
    if (expression?.kind !== 'identifier' || expression.name !== '_') continue;
    primitive.dimensionPlaceholders ??= {};
    primitive.dimensionPlaceholders[field as CompactSketchParameter] =
      expression.span;
  }
}

/**
 * Parses dimension assignments immediately following one compact sketch.
 * Keeping these declarations owned by the primitive allows `_` to be resolved
 * before ordinary expression lookup and keeps the editor replacement range
 * inclusive of the dimension lines.
 */
export function parseCompactSketchDimensions(
  p: Parser,
  sketchName: string,
  primitive: SketchPrimitive,
): void {
  const owners = compactDimensionPrimitives(primitive);
  while (owners.length > 0 && isDimensionStart(p, sketchName)) {
    const dimension = parseDimension(p, sketchName);
    const matching = owners.filter((owner) => ownsDimension(owner, dimension));
    if (matching.length !== 1) {
      p.addError(
        matching.length === 0
          ? `No compact primitive owns dimension reference '${dimension.target}'`
          : `Compact dimension reference '${dimension.target}' is ambiguous`,
        dimension.span,
      );
      continue;
    }
    matching[0].compactDimensions ??= [];
    matching[0].compactDimensions.push(dimension);
  }
}

/**
 * Handles owns dimension in the sketch flow.
 */
function ownsDimension(
  primitive: CompactDimensionPrimitive,
  dimension: CompactSketchDimensionDecl,
): boolean {
  const references = [dimension.target, dimension.ref].filter(
    (reference): reference is string =>
      typeof reference === 'string' && !reference.startsWith('origin'),
  );
  return references.every((reference) =>
    compactDimensionPrimitiveOwnsReference(primitive, reference),
  );
}

/**
 * Returns whether the input meets the `dimension start` condition.
 */
function isDimensionStart(p: Parser, sketchName: string): boolean {
  if (!p.check('AT_SIGN')) return false;
  if (p.peek(1).kind === 'LPAREN') return true;
  if (
    p.peek(1).kind !== 'IDENT' ||
    p.peek(1).value !== sketchName ||
    p.peek(2).kind !== 'DOT'
  ) {
    return false;
  }
  let offset = 3;
  while (isLocalReferencePart(p.peek(offset).kind)) {
    offset += 1;
    if (p.peek(offset).kind !== 'DOT') break;
    offset += 1;
  }
  return (
    p.peek(offset).kind === 'ASSIGN' && p.peek(offset + 1).kind !== 'AT_SIGN'
  );
}

/**
 * Parses dimension from the supplied source into the sketch representation.
 */
function parseDimension(
  p: Parser,
  sketchName: string,
): CompactSketchDimensionDecl {
  const start = p.expect('AT_SIGN').span;
  const pair = p.eat('LPAREN');
  const target = parseLocalReference(p, sketchName);
  let ref: string | undefined;
  if (pair) {
    p.expect('COMMA');
    ref = parseLocalReference(p, sketchName);
    p.expect('RPAREN');
  }
  p.expect('ASSIGN');
  const value = p.parseExpr();
  const offset = p.eat('AT') ? p.parseExpr() : undefined;
  const name = p.eat('AS') ? p.expect('IDENT').value : undefined;
  p.requireSemi();
  const property = terminalReferencePart(target);
  return {
    kind: 'compactDimension',
    name,
    dimension: ref
      ? 'distance'
      : property === 'diameter'
        ? 'diameter'
        : property === 'radius'
          ? 'radius'
          : 'length',
    target,
    property,
    ref,
    value,
    offset,
    span: p.spanFrom(start),
  };
}

/**
 * Parses local reference from the supplied source into the sketch representation.
 */
function parseLocalReference(p: Parser, sketchName: string): string {
  p.eat('AT_SIGN');
  let reference = p.expect('IDENT').value;
  while (p.eat('DOT')) reference += `.${parseLocalReferencePart(p)}`;
  const prefix = `${sketchName}.`;
  return reference.startsWith(prefix)
    ? reference.slice(prefix.length)
    : reference;
}

/**
 * Parses local reference part from the supplied source into the sketch representation.
 */
function parseLocalReferencePart(p: Parser): string {
  const token = p.eat('IDENT', 'RADIUS');
  return token?.value ?? p.expect('IDENT').value;
}

/**
 * Returns whether the input meets the `local reference part` condition.
 */
function isLocalReferencePart(kind: string): boolean {
  return kind === 'IDENT' || kind === 'RADIUS';
}

/**
 * Handles terminal reference part in the sketch flow.
 */
function terminalReferencePart(reference: string): string {
  return reference.slice(reference.lastIndexOf('.') + 1);
}
