/**
 * @author Aidan Boissonneault
 * @file textPositions.ts
 * @purpose Provides text positions behavior for the language in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguagePosition } from '../protocol/ILanguageServer.js';

/**
 * Word at position, including word, start, and end.
 */
type WordAtPosition = {
  word: string;
  start: LanguagePosition;
  end: LanguagePosition;
};

/**
 * Converts a one-based line/column position into a string offset.
 * LSP-style APIs speak in document positions, while symbol and reference
 * searches operate on plain source strings.
 */
export function offsetAt(source: string, position: LanguagePosition): number {
  let line = 1;
  let index = 0;
  while (line < position.line && index < source.length) {
    const next = source.indexOf('\n', index);
    if (next === -1) return source.length;
    index = next + 1;
    line++;
  }
  return Math.min(source.length, index + Math.max(0, position.col - 1));
}

/**
 * Converts a zero-based string offset into a one-based line/column position.
 * Regular expression matches and parser spans need a shared conversion path so
 * navigation and semantic token ranges stay consistent.
 */
export function positionAt(source: string, offset: number): LanguagePosition {
  const safeOffset = Math.max(0, Math.min(offset, source.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < safeOffset; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: safeOffset - lineStart + 1 };
}

/**
 * Finds the identifier under a document position.
 * Hover, definition, and reference requests all start from the same word
 * selection behavior.
 */
export function wordAtPosition(
  source: string,
  position: LanguagePosition,
): WordAtPosition {
  const offset = offsetAt(source, position);
  let start = offset;
  let end = offset;
  while (start > 0 && /[A-Za-z0-9_]/.test(source[start - 1])) start--;
  while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end++;
  return {
    word: source.slice(start, end),
    start: positionAt(source, start),
    end: positionAt(source, end),
  };
}
