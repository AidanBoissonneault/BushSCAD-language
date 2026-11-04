/**
 * @author Aidan Boissonneault
 * @file parse-top-level-statement.ts
 * @purpose Parses top level statement for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type { TopLevelStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { Token, TokenKind } from '../core/token-types.js';
import {
  isDefeatureStart,
  isHealStart,
  isShapeImportStart,
  parseDefeature,
  parseFontImport,
  parseHeal,
  parseShapeImport,
} from './parse-declarations.js';
import { parseDrawingDecl } from '../geometry/parse-drawing.js';
import { isJointDeclStart, parseJointDecl } from '../objects/parse-joint.js';
import { parseFn } from './parse-control-flow.js';
import { parseExport, parseImport, parsePart } from './parse-top-level.js';
import { parseSharedDeclaration } from './parse-shared-declaration.js';
import { parseSharedBodyOperation } from './parse-shared-body-operation.js';

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
  IDENT: parseIdentTopLevelStatement,
  PART: (p) => parsePart(p),
  FN: (p) => parseFn(p, false),
  IMPORT: parseImportTopLevelStatement,
  EXPORT: (p) => parseExport(p),
  DRAWING: (p) => parseDrawingDecl(p),
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
  const sharedOperation = parseSharedBodyOperation(p);
  if (sharedOperation) return sharedOperation as TopLevelStatement;
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
