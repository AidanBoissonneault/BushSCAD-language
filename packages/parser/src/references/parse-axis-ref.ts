/**
 * @author Aidan Boissonneault
 * @file parse-axis-ref.ts
 * @purpose Parses axis ref for the references in parser package.
 * @last-edited October 6, 2026
 */

import type { RevolveAxisRef } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

/**
 * Parses a world-axis shorthand or face-derived axis reference.
 * Revolve and radial operations share this syntax, and radial parsing now lives
 * outside the generic object-operation parser.
 */
export function parseAxisRef(p: Parser): RevolveAxisRef {
  const first = p.expect('IDENT');
  if (
    (first.value === 'x' || first.value === 'y' || first.value === 'z') &&
    !p.check('DOT')
  ) {
    return first.value;
  }
  return p.parseFaceRefFromIdent(first);
}
