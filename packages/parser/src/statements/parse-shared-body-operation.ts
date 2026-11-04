/**
 * @author Aidan Boissonneault
 * @file parse-shared-body-operation.ts
 * @purpose Parses body operations accepted in every statement scope.
 * @last-edited November 4, 2026
 */

import type { ComponentStatement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import type { TokenKind } from '../core/token-types.js';
import { parseAssert } from './parse-assert.js';
import { parseFitDecl } from '../objects/parse-fit.js';
import {
  parseChamfer,
  parseDraft,
  parseFillet,
  parseShell,
} from './parse-modifiers.js';
import { parseThread } from './parse-thread.js';
import { parseMirror } from '../objects/parse-mirror.js';
import { parsePattern } from '../objects/parse-patterns.js';
import { parseTransform } from '../objects/parse-transform.js';
import { parsePlace } from '../objects/parse-place.js';
import { parseRotate } from './parse-top-level.js';

type SharedBodyOperationParser = (p: Parser) => ComponentStatement;

const SHARED_BODY_OPERATION_PARSERS: Partial<
  Record<TokenKind, SharedBodyOperationParser>
> = {
  ROTATE: (p) => parseRotate(p),
  FILLET: (p) => parseFillet(p),
  CHAMFER: (p) => parseChamfer(p),
  SHELL: (p) => parseShell(p),
  DRAFT: (p) => parseDraft(p),
  THREAD: (p) => parseThread(p),
  PLACE: (p) => parsePlace(p),
  PATTERN: (p) => parsePattern(p),
  MIRROR: (p) => parseMirror(p),
  TRANSFORM: (p) => parseTransform(p),
  ASSERT: (p) => parseAssert(p),
  FIT: (p) => parseFitDecl(p),
};

/** Parses a body operation shared by root, part, function, loop, and branch scopes. */
export function parseSharedBodyOperation(p: Parser): ComponentStatement | null {
  const parser = SHARED_BODY_OPERATION_PARSERS[p.peek().kind];
  return parser ? parser(p) : null;
}
