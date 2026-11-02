/**
 * @author Aidan Boissonneault
 * @file semanticTokens.ts
 * @purpose Provides semantic tokens behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import type { SemanticToken } from '../protocol/ILanguageServer.js';
import {
  BUSHSCAD_BUILTINS,
  BUSHSCAD_KEYWORDS,
  BUSHSCAD_SURFACE_REFS,
} from '../language/syntaxFacts.js';
import { positionAt } from '../language/textPositions.js';
import { tokenize } from '@bushscad/parser';

const WORD_RE = /\b[A-Za-z_][\w]*\b/g;

/**
 * Handles token type in the providers flow.
 */
function tokenType(word: string): SemanticToken['type'] | null {
  if (BUSHSCAD_KEYWORDS.includes(word)) return 'keyword';
  if (BUSHSCAD_BUILTINS.includes(word)) return 'function';
  if (BUSHSCAD_SURFACE_REFS.includes(word)) return 'property';
  return null;
}

/**
 * Scans a document into stable semantic token ranges.
 * The editor can layer semantic highlighting over Monarch syntax without
 * needing a full resolver result for every keystroke.
 */
export function collectSemanticTokens(source: string): SemanticToken[] {
  const tokens: SemanticToken[] = [];
  const ignored = ignoredTokenOffsets(source);
  for (const match of source.matchAll(WORD_RE)) {
    const word = match[0];
    const type = tokenType(word);
    if (!type || match.index == null || ignored[match.index]) continue;
    const position = positionAt(source, match.index);
    tokens.push({
      line: position.line,
      col: position.col,
      length: word.length,
      type,
    });
  }
  return tokens;
}

/** Marks strings and comments so language words inside prose stay uncoloured. */
function ignoredTokenOffsets(source: string): boolean[] {
  const ignored = new Array<boolean>(source.length).fill(false);
  let index = 0;
  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];
    if (character === '/' && next === '/') {
      index = markThrough(source, ignored, index, '\n');
    } else if (character === '/' && next === '*') {
      index = markThrough(source, ignored, index, '*/');
    } else if (character === '"' || character === "'") {
      index = markString(source, ignored, index, character);
    } else {
      index++;
    }
  }
  for (const range of collectTemplateStringRanges(source)) {
    for (let offset = range.start; offset < range.end; offset++) {
      ignored[offset] = true;
    }
  }
  return ignored;
}

/** Returns source-offset ranges occupied by template delimiters and literal text. */
export function collectTemplateStringRanges(
  source: string,
): Array<{ start: number; end: number }> {
  const lineStarts = [
    0,
    ...Array.from(source.matchAll(/\n/g), (match) => (match.index ?? -1) + 1),
  ];
  return tokenize(source, '<semantic-tokens>')
    .filter((token) =>
      ['TEMPLATE_START', 'TEMPLATE_TEXT', 'TEMPLATE_END'].includes(token.kind),
    )
    .map((token) => ({
      start: (lineStarts[token.span.line - 1] ?? 0) + token.span.col - 1,
      end: (lineStarts[token.span.endLine - 1] ?? 0) + token.span.endCol - 1,
    }));
}

/**
 * Updates state to record through.
 */
function markThrough(
  source: string,
  ignored: boolean[],
  start: number,
  terminator: string,
): number {
  const found = source.indexOf(terminator, start + terminator.length);
  const end = found === -1 ? source.length : found + terminator.length;
  for (let index = start; index < end; index++) ignored[index] = true;
  return end;
}

/**
 * Updates state to record string.
 */
function markString(
  source: string,
  ignored: boolean[],
  start: number,
  quote: string,
): number {
  let index = start;
  for (; index < source.length; index++) {
    ignored[index] = true;
    if (source[index] === '\\') {
      if (index + 1 < source.length) ignored[++index] = true;
    } else if (index > start && source[index] === quote) {
      return index + 1;
    }
  }
  return index;
}
