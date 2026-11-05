/** Parses named plane declarations. */

import type { PlaneDecl } from '@bushscad/ir';

import type { Parser } from '../../core/parser.js';

/**
 * Parses plane from the supplied source into the statements representation.
 */
export function parsePlane(p: Parser): PlaneDecl {
  const start = p.peek().span;
  p.advance(); // PLANE
  const name = p.expect('IDENT').value;
  p.expect('ASSIGN');
  p.expect('OFFSET');
  p.expect('LPAREN');
  const offset = p.parseExpr();
  p.expect('COMMA');
  const from = p.parseSpatialRef();
  p.expect('RPAREN');
  p.requireSemi();
  return { kind: 'plane', name, offset, from, span: p.spanFrom(start) };
}
