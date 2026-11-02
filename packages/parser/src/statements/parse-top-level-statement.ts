/**
 * @author Aidan Boissonneault
 * @file parse-top-level-statement.ts
 * @purpose Parses top level statement for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type { TopLevelStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { Token, TokenKind } from '../core/token-types.js';
import { parseAssert } from './parse-assert.js';
import {
  isDefeatureStart,
  isHealStart,
  isShapeImportStart,
  parseDefeature,
  parseEnv,
  parseFontImport,
  parseHeal,
  parseShapeImport,
  parseVar,
} from './parse-declarations.js';
import { parseDrawingDecl } from '../geometry/parse-drawing.js';
import { parseFitDecl } from '../objects/parse-fit.js';
import { isJointDeclStart, parseJointDecl } from '../objects/parse-joint.js';
import { parseMirror } from '../objects/parse-mirror.js';
import { parsePattern } from '../objects/parse-patterns.js';
import { parseTransform } from '../objects/parse-transform.js';
import { parsePlace } from '../objects/parse-place.js';
import { parseSheetDecl } from '../geometry/parse-sheet.js';
import { parseFillet } from './parse-modifiers.js';
import { parseFn } from './parse-control-flow.js';
import {
  parseExport,
  parseImport,
  parsePart,
  parseRotate,
  parseUseDecl,
} from './parse-top-level.js';
import { parseSharedDeclaration } from './parse-shared-declaration.js';

/**
 * Defines the `TopLevelStatementParser` callback contract used by the statements layer.
 */
type TopLevelStatementParser = (
  p: Parser,
  token: Token,
) => TopLevelStatement | null;

const TOP_LEVEL_STATEMENT_PARSERS: Partial<
  Record<TokenKind, TopLevelStatementParser>
> = {
  VAR: (p) => parseVar(p),
  ENV: (p) => parseEnv(p),
  USE: (p) => parseUseDecl(p),
  IDENT: parseIdentTopLevelStatement,
  ROTATE: (p) => parseRotate(p),
  FILLET: (p) => parseFillet(p),
  PLACE: (p) => parsePlace(p),
  PATTERN: (p) => parsePattern(p),
  MIRROR: (p) => parseMirror(p),
  TRANSFORM: (p) => parseTransform(p),
  PART: (p) => parsePart(p),
  FN: (p) => parseFn(p, false),
  IMPORT: parseImportTopLevelStatement,
  EXPORT: (p) => parseExport(p),
  ASSERT: (p) => parseAssert(p),
  FIT: (p) => parseFitDecl(p),
  DRAWING: (p) => parseDrawingDecl(p),
  SHEET: (p) => parseSheetDecl(p),
};

/**
 * Parses one statement allowed at the program root.
 *
 * Common declaration forms are checked first, then token-specific handlers keep
 * root-only syntax errors and import variants in one place.
 */
export function parseTopLevelStatement(p: Parser): TopLevelStatement | null {
  const t = p.peek();
  const shared = parseSharedDeclaration(p);
  if (shared) return shared as TopLevelStatement;
  const parser = TOP_LEVEL_STATEMENT_PARSERS[t.kind];
  if (parser) return parser(p, t);
  return p.fail(`Unexpected top-level token '${t.kind}'`, t.span);
}

/**
 * Parses ident top level statement from the supplied source into the statements representation.
 */
function parseIdentTopLevelStatement(
  p: Parser,
  token: Token,
): TopLevelStatement | null {
  if (isJointDeclStart(p)) return parseJointDecl(p);
  if (p.isFontImportStart()) return parseFontImport(p);
  if (isHealStart(p)) return parseHeal(p);
  if (isDefeatureStart(p)) return parseDefeature(p);
  return p.fail(`Unexpected token '${token.value}'`, token.span);
}

/**
 * Parses import top level statement from the supplied source into the statements representation.
 */
function parseImportTopLevelStatement(p: Parser): TopLevelStatement | null {
  if (isShapeImportStart(p)) return parseShapeImport(p);
  return parseImport(p);
}
