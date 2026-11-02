/**
 * @author Aidan Boissonneault
 * @file parse-shared-declaration.ts
 * @purpose Parses shared declaration for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type { ComponentStatement, TopLevelStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseSketch } from '../sketch/parse-sketch.js';
import { parseObj } from '../objects/parse-object-ops.js';
import { parsePath } from '../paths/parse-paths.js';
import { parseRef } from './parse-top-level.js';
import { parseSpatialAnchor } from './parse-modifiers.js';
import { parseSurfaceDecl } from '../geometry/parse-surface.js';

/**
 * Parses declarations accepted in both top-level and component scopes.
 *
 * Shared declaration routing keeps common statement forms consistent across
 * scopes, especially for `@` anchor aliases.
 */
export function parseSharedDeclaration(
  p: Parser,
): TopLevelStatement | ComponentStatement | null {
  switch (p.peek().kind) {
    case 'SKETCH':
      return parseSketch(p);
    case 'SURFACE':
      return parseSurfaceDecl(p);
    case 'PATH':
      return parsePath(p);
    case 'OBJ':
      return parseObj(p);
    case 'AT_SIGN':
      return parseSpatialAnchor(p);
    case 'REF':
      return parseRef(p);
    default:
      return null;
  }
}
