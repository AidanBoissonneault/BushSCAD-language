/**
 * @author Aidan Boissonneault
 * @file parse-component-statement.ts
 * @purpose Parses component statement for the statements in parser package.
 * @last-edited October 6, 2026
 */

import type { ComponentStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { Token, TokenKind } from '../core/token-types.js';
import { parseAssert } from './parse-assert.js';
import {
  parseCallStatement,
  parseFn,
  parseFor,
  parseIf,
  parseReturn,
} from './parse-control-flow.js';
import {
  isDefeatureStart,
  isHealStart,
  parseDefeature,
  parseEnv,
  parseHeal,
  parseVar,
} from './parse-declarations.js';
import { parseFitDecl } from '../objects/parse-fit.js';
import { isJointDeclStart, parseJointDecl } from '../objects/parse-joint.js';
import {
  parseAnchor,
  parseChamfer,
  parseDraft,
  parseFillet,
  parsePlane,
  parseShell,
} from './parse-modifiers.js';
import { parseThread } from './parse-thread.js';
import {
  parseMetadataAssignment,
  rejectThisMetadataAssignment,
} from './parse-metadata.js';
import { parseMirror } from '../objects/parse-mirror.js';
import { parsePattern } from '../objects/parse-patterns.js';
import { parseTransform } from '../objects/parse-transform.js';
import { parsePlace } from '../objects/parse-place.js';
import { parseRotate, parseUseDecl } from './parse-top-level.js';
import { parseSheetDecl } from '../geometry/parse-sheet.js';
import { parseSharedDeclaration } from './parse-shared-declaration.js';

/**
 * Defines the `ComponentStatementParser` callback contract used by the statements layer.
 */
type ComponentStatementParser = (
  p: Parser,
  token: Token,
) => ComponentStatement | null;

const COMPONENT_STATEMENT_PARSERS: Partial<
  Record<TokenKind, ComponentStatementParser>
> = {
  VAR: (p) => parseVar(p),
  ENV: (p) => parseEnv(p),
  USE: (p) => parseUseDecl(p),
  FN: (p) => parseFn(p, false),
  FOR: (p) => parseFor(p),
  IF: (p) => parseIf(p),
  PLACE: (p) => parsePlace(p),
  ROTATE: (p) => parseRotate(p),
  PATTERN: (p) => parsePattern(p),
  MIRROR: (p) => parseMirror(p),
  TRANSFORM: (p) => parseTransform(p),
  RETURN: (p) => parseReturn(p),
  FILLET: (p) => parseFillet(p),
  CHAMFER: (p) => parseChamfer(p),
  SHELL: (p) => parseShell(p),
  DRAFT: (p) => parseDraft(p),
  THREAD: (p) => parseThread(p),
  ANCHOR: (p) => parseAnchor(p),
  PLANE: (p) => parsePlane(p),
  COLOR: rejectLooseColorStatement,
  MATERIAL: rejectLooseMaterialStatement,
  PART: parsePartComponentStatement,
  THIS: parseThisComponentStatement,
  ASSERT: (p) => parseAssert(p),
  FIT: (p) => parseFitDecl(p),
  SHEET: (p) => parseSheetDecl(p),
  IDENT: parseIdentComponentStatement,
};

/**
 * Parses one statement allowed inside a component body.
 *
 * Shared declarations are accepted before body-only handlers so metadata
 * assignments, modifiers, control flow, and call statements keep their original
 * precedence and diagnostics.
 */
export function parseComponentStatement(p: Parser): ComponentStatement | null {
  const t = p.peek();
  const shared = parseSharedDeclaration(p);
  if (shared) return shared as ComponentStatement;
  const parser = COMPONENT_STATEMENT_PARSERS[t.kind];
  if (parser) return parser(p, t);
  return p.fail(`Unexpected component statement token '${t.kind}'`, t.span);
}

/**
 * Handles reject loose color statement in the statements flow.
 */
function rejectLooseColorStatement(
  p: Parser,
  token: Token,
): ComponentStatement | null {
  return p.fail(
    `Loose 'color:' statements were removed; use part.color = #rrggbb`,
    token.span,
  );
}

/**
 * Handles reject loose material statement in the statements flow.
 */
function rejectLooseMaterialStatement(
  p: Parser,
  token: Token,
): ComponentStatement | null {
  return p.fail(
    `Loose 'material:' statements were removed; use part.material = 'name'`,
    token.span,
  );
}

/**
 * Parses part component statement from the supplied source into the statements representation.
 */
function parsePartComponentStatement(
  p: Parser,
  token: Token,
): ComponentStatement | null {
  if (p.peek(1).kind === 'DOT') return parseMetadataAssignment(p);
  return p.fail(`Nested part declarations are not valid here`, token.span);
}

/**
 * Parses this component statement from the supplied source into the statements representation.
 */
function parseThisComponentStatement(
  p: Parser,
  token: Token,
): ComponentStatement | null {
  if (p.peek(1).kind === 'DOT') return rejectThisMetadataAssignment(p);
  return p.fail(`Unexpected this statement`, token.span);
}

/**
 * Parses ident component statement from the supplied source into the statements representation.
 */
function parseIdentComponentStatement(
  p: Parser,
  token: Token,
): ComponentStatement | null {
  if (isJointDeclStart(p)) return parseJointDecl(p);
  if (isHealStart(p)) return parseHeal(p);
  if (isDefeatureStart(p)) return parseDefeature(p);
  if (p.peek(1).kind === 'DOT') return parseMetadataAssignment(p);
  if (p.peek(1).kind === 'LPAREN') return parseCallStatement(p);
  return p.fail(`Unexpected token '${token.value}'`, token.span);
}
