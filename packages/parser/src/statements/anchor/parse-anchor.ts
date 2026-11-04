/** Parses the supported spatial anchor declaration form. */

import type { AnchorDecl } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

/**
 * Parses anchor from the supplied source into the statements representation.
 */
export function parseAnchor(p: Parser): AnchorDecl {
  p.fail(
    `anchor declarations have been removed; use @name = @target`,
    p.peek().span,
  );
}

/**
 * Parses an `@name = @target` spatial alias or component anchor declaration.
 *
 * The `@` declaration syntax replaces both named anchors and exact spatial
 * alias overrides while keeping their evaluator representation compact.
 */
export function parseSpatialAnchor(p: Parser): AnchorDecl {
  const start = p.peek().span;
  p.expect('AT_SIGN');
  let name = p.expect('IDENT').value;
  while (p.eat('DOT')) {
    name += `.${p.expect('IDENT').value}`;
  }
  p.expect('ASSIGN');
  const point = p.parseSpatialRef();
  p.eatSemi();
  return { kind: 'anchor', name, point, span: p.spanFrom(start) };
}
