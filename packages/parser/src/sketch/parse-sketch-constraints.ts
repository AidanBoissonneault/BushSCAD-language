/**
 * @author Aidan Boissonneault
 * @file parse-sketch-constraints.ts
 * @purpose Parses sketch constraints for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ConstraintDecl,
  ConstraintKind,
  Expr,
  SketchDimensionAxis,
} from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { expectName, isNameToken } from '../expressions/parse-names.js';
import { parsePointTuple2 } from './parse-sketch-points.js';

/**
 * Constraint parts, including constraint, target, property, ref, and axis.
 */
type ConstraintParts = {
  constraint: ConstraintKind;
  target: string;
  property?: string;
  ref?: string;
  axis?: SketchDimensionAxis;
  value?: Expr;
  label?: [Expr, Expr];
};

const geometricRefs = new Set<ConstraintKind>([
  'horizontal',
  'vertical',
  'parallel',
  'perpendicular',
  'tangent',
  'equal',
  'coincident',
  'symmetric',
  'midpoint',
]);

const dimensional = new Set<ConstraintKind>([
  'length',
  'distance',
  'angle',
  'radius',
  'diameter',
]);

/**
 * Parses modern sketch constraints as `constraint(target, type, ...)` calls.
 * The public language now uses function-like sketch declarations while the
 * resolver/evaluator continue to consume the existing normalized constraint IR.
 */
export function parseConstraintCall(p: Parser): ConstraintDecl | null {
  if (!isConstraintCallStart(p)) return null;
  const start = p.advance().span;
  p.expect('LPAREN');
  const target = parseConstraintName(p);
  p.expect('COMMA');
  const constraint = constraintKind(expectName(p).value, p, start);
  const parts: ConstraintParts = { constraint, target };
  parseConstraintArgs(p, parts);
  p.expect('RPAREN');
  const name = parseOptionalDimensionName(p);
  return { kind: 'constraint', name, ...parts, span: p.spanFrom(start) };
}

/**
 * Handles consume legacy constrain in the sketch flow.
 */
export function consumeLegacyConstrain(p: Parser): boolean {
  if (!p.check('CONSTRAIN')) return false;
  const start = p.advance().span;
  p.addError(
    'Old constrain syntax has been removed. Use constraint(target, type, ...) instead.',
    start,
  );
  while (!p.check('EOF', 'COMMA', 'SEMICOLON', 'RBRACE', 'RPAREN')) p.advance();
  return true;
}

/**
 * Returns whether the input meets the `constraint call start` condition.
 */
function isConstraintCallStart(p: Parser): boolean {
  return (
    p.peek().kind === 'IDENT' &&
    p.peek().value === 'constraint' &&
    p.peek(1).kind === 'LPAREN'
  );
}

/**
 * Parses constraint args from the supplied source into the sketch representation.
 */
function parseConstraintArgs(p: Parser, parts: ConstraintParts): void {
  if (p.eat('COMMA')) {
    if (parts.constraint === 'distance') {
      parts.ref = parseConstraintName(p);
      p.expect('COMMA');
      parts.value = p.parseExpr();
      parts.property = 'distance';
    } else if (parts.constraint === 'angle' && isRelativeAngleStart(p)) {
      parts.ref = parseConstraintName(p);
      p.expect('COMMA');
      parts.value = p.parseExpr();
      parts.property = 'angle';
    } else if (dimensional.has(parts.constraint)) {
      parts.value = p.parseExpr();
      parts.property = parts.constraint;
    } else if (geometricRefs.has(parts.constraint)) {
      parts.ref = parseConstraintName(p);
    } else {
      p.addError(
        `constraint(${parts.target}, ${parts.constraint}) does not accept another positional argument`,
        p.peek().span,
      );
      p.parseExpr();
    }
  }
  while (p.eat('COMMA')) parseConstraintOption(p, parts);
}

/**
 * Parses constraint option from the supplied source into the sketch representation.
 */
function parseConstraintOption(p: Parser, parts: ConstraintParts): void {
  if (p.peek().kind === 'IDENT' && p.peek().value === 'axis') {
    const span = p.advance().span;
    p.expect('COLON');
    const value = expectName(p).value;
    if (parts.constraint !== 'distance') {
      p.addError('Only distance constraints accept an axis option', span);
      return;
    }
    if (value !== 'x' && value !== 'y') {
      p.addError("Distance axis must be 'x' or 'y'", span);
      return;
    }
    parts.axis = value;
    return;
  }
  if (parts.label) {
    p.addError('Constraint label is already specified', p.peek().span);
    parseAtLabel(p);
    return;
  }
  parts.label = parseAtLabel(p);
}

/**
 * Returns whether the input meets the `relative angle start` condition.
 */
function isRelativeAngleStart(p: Parser): boolean {
  if (!isNameToken(p.peek())) return false;
  if (p.peek(1).kind === 'COMMA') return true;
  return (
    p.peek(1).kind === 'DOT' &&
    isNameToken(p.peek(2)) &&
    p.peek(3).kind === 'COMMA'
  );
}

/**
 * Parses at label from the supplied source into the sketch representation.
 */
function parseAtLabel(p: Parser): [Expr, Expr] {
  if (p.eat('AT')) {
    p.expect('COLON');
    return parsePointTuple2(p);
  }
  if (p.peek().kind === 'IDENT' && p.peek().value === 'at') {
    p.advance();
    p.expect('COLON');
    return parsePointTuple2(p);
  }
  return parsePointTuple2(p);
}

/**
 * Parses constraint name from the supplied source into the sketch representation.
 */
function parseConstraintName(p: Parser): string {
  let name = expectName(p).value;
  if (p.eat('DOT')) name = `${name}.${expectName(p).value}`;
  return name;
}

/**
 * Handles constraint kind in the sketch flow.
 */
function constraintKind(
  value: string,
  p: Parser,
  span: import('@bushscad/ir').ASTSourceSpan,
): ConstraintKind {
  const kinds: Record<string, ConstraintKind> = {
    horizontal: 'horizontal',
    vertical: 'vertical',
    parallel: 'parallel',
    perpendicular: 'perpendicular',
    tangent: 'tangent',
    equal: 'equal',
    symmetric: 'symmetric',
    fixed: 'fixed',
    coincident: 'coincident',
    midpoint: 'midpoint',
    length: 'length',
    distance: 'distance',
    angle: 'angle',
    radius: 'radius',
    diameter: 'diameter',
  };
  const kind = kinds[value];
  if (!kind) p.addError(`Unknown constraint kind '${value}'`, span);
  return kind ?? 'horizontal';
}

/** Reads the optional sketch-local name shared by driving and reference dimensions. */
export function parseOptionalDimensionName(p: Parser): string | undefined {
  return p.eat('AS') ? expectName(p).value : undefined;
}
