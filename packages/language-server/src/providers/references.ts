/**
 * @author Aidan Boissonneault
 * @file references.ts
 * @purpose Provides references behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import type { LanguageLocation } from '../protocol/ILanguageServer.js';
import { positionAt } from '../language/textPositions.js';
import { uriFromPath } from '../language/uri.js';

/**
 * Finds identifier references across the supplied source map.
 * Early language-server references should be project-aware even before a richer
 * resolver-side symbol table exists.
 */
export function findIdentifierReferences(
  fileMap: Record<string, string>,
  word: string,
): LanguageLocation[] {
  if (!word) return [];
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'g');
  const locations: LanguageLocation[] = [];
  for (const [filePath, source] of Object.entries(fileMap)) {
    for (const match of source.matchAll(regex)) {
      if (match.index == null) continue;
      const start = positionAt(source, match.index);
      locations.push({
        uri: uriFromPath(filePath),
        range: {
          start,
          end: { line: start.line, col: start.col + word.length },
        },
      });
    }
  }
  return locations;
}
