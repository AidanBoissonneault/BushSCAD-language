/**
 * @author Aidan Boissonneault
 * @file parse-metadata.ts
 * @purpose Parses metadata for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type { MetadataAssignment } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Parses explicit metadata assignment statements for part and object defaults.
 * Metadata now uses statement syntax such as `part.color = #2563EB;` instead
 * of loose `color:` or `material:` body declarations. Keeping this parser
 * separate prevents metadata from becoming a general assignment expression.
 */
export function parseMetadataAssignment(p: Parser): MetadataAssignment {
  const start = p.peek().span;
  const targetToken = p.advance();
  const isPartTarget = targetToken.kind === 'PART';
  const isObjectTarget = targetToken.kind === 'IDENT';
  p.expect('DOT');
  const propertyToken = p.advance();
  const property = propertyToken.value;

  if (!isPartTarget && !isObjectTarget) {
    p.fail(
      `Metadata must target 'part' or an object name; '${targetToken.value}' is not supported`,
      targetToken.span,
    );
  }
  if (property === 'colour') {
    p.fail(
      `Use '${targetToken.value}.color', not '${targetToken.value}.colour'`,
      propertyToken.span,
    );
  }
  if (property !== 'color' && property !== 'material') {
    p.fail(
      `Unknown metadata property '${property}'; use color or material`,
      propertyToken.span,
    );
  }

  p.expect('ASSIGN');
  const value = p.parseExpr();
  p.eatSemi();
  return {
    kind: 'metadata',
    target: isPartTarget
      ? { kind: 'part' }
      : { kind: 'object', name: targetToken.value },
    property,
    value,
    span: p.spanFrom(start),
  };
}

/**
 * Rejects `this.color` and `this.material` as metadata assignment targets.
 * `this.` remains reserved for contextual face/plane data and should not mix
 * with part or object metadata state.
 */
export function rejectThisMetadataAssignment(p: Parser): never {
  const start = p.peek().span;
  p.advance(); // THIS
  p.expect('DOT');
  const property = p.advance();
  if (property.value === 'color' || property.value === 'material') {
    p.fail(
      `this.${property.value} is contextual geometry data, not metadata; use part.${property.value} or object.${property.value}`,
      p.spanFrom(start),
    );
  }
  p.fail(`Unknown this.${property.value}`, p.spanFrom(start));
}
