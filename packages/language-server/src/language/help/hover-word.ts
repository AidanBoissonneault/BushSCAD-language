/**
 * @author Aidan Boissonneault
 * @file hover-word.ts
 * @purpose Provides hover word behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguagePosition } from '../../protocol/ILanguageServer.js';
import { offsetAt, positionAt, wordAtPosition } from '../textPositions.js';

/** Selects documented compound tokens and numeric suffixes without changing navigation tokenization. */
export function hoverWordAtPosition(
  source: string,
  position: LanguagePosition,
): ReturnType<typeof wordAtPosition> {
  const word = wordAtPosition(source, position);
  const offset = offsetAt(source, position);
  const start = Math.max(0, offset - 20);
  const nearby = source.slice(start, offset + 20);
  for (const match of nearby.matchAll(
    /\b(?:ease-in-out|ease-in|ease-out|step-start|step-end|cubic-bezier)\b/g,
  )) {
    const matchStart = start + match.index;
    const matchEnd = matchStart + match[0].length;
    if (matchStart <= offset && offset <= matchEnd) {
      return {
        word: match[0],
        start: positionAt(source, matchStart),
        end: positionAt(source, matchEnd),
      };
    }
  }
  const suffix = /^\d+(?:[eE]\d+)?(mm|cm|m|in|ft|deg)$/.exec(word.word)?.[1];
  if (suffix) {
    const suffixStart = word.end.col - suffix.length;
    if (position.col >= suffixStart)
      return {
        word: suffix,
        start: { ...word.end, col: suffixStart },
        end: word.end,
      };
  }
  return word;
}
