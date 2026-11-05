/**
 * @author Aidan Boissonneault
 * @file parse-surface.ts
 * @purpose Parses surface for the geometry in parser package.
 * @last-edited October 6, 2026
 */

import type { SurfaceDecl, SurfaceInput, SurfaceOperation } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseFaceRefFromIdent } from '../references/parse-refs.js';

/**
 * Parses surface declarations.
 * Surface modeling has its own symbol category and operation family, so keeping
 * this grammar separate prevents object-operation parsing from absorbing
 * non-solid responsibilities.
 */
export function parseSurfaceDecl(p: Parser): SurfaceDecl {
  const start = p.peek().span;
  p.advance(); // SURFACE
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  p.expect('ASSIGN');
  const operation = parseSurfaceOperation(p);
  p.requireSemi();
  return {
    kind: 'surface',
    name,
    nameSpan: nameToken.span,
    operation,
    span: p.spanFrom(start),
  };
}

/**
 * Parses surface operation from the supplied source into the geometry representation.
 */
function parseSurfaceOperation(p: Parser): SurfaceOperation {
  const start = p.peek().span;
  if (p.eat('FILL')) {
    p.expect('LPAREN');
    const boundary = p.check('AT_SIGN', 'LBRACKET')
      ? p.parsePlacementAsFaceRef()
      : parseFaceRefFromIdent(p, p.expect('IDENT'));
    p.expect('RPAREN');
    return { kind: 'fill', boundary, span: p.spanFrom(start) };
  }

  if (p.eat('OFFSET_SURFACE')) {
    p.expect('LPAREN');
    const surface = parseSurfaceInput(p);
    p.expect('COMMA');
    const distance = p.parseExpr();
    p.expect('RPAREN');
    return {
      kind: 'offset_surface',
      surface,
      distance,
      span: p.spanFrom(start),
    };
  }

  p.fail(
    `Expected fill(...) or offset_surface(...), got ${p.peek().kind}`,
    p.peek().span,
  );
}

/**
 * Parses surface input from the supplied source into the geometry representation.
 */
export function parseSurfaceInput(p: Parser): SurfaceInput {
  const start = p.peek().span;
  if (p.check('FILL', 'OFFSET_SURFACE')) {
    return {
      kind: 'inlineSurface',
      operation: parseSurfaceOperation(p),
      span: p.spanFrom(start),
    };
  }
  const name = p.expect('IDENT');
  return { kind: 'namedSurface', name: name.value, span: name.span };
}
