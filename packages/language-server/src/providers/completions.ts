/**
 * @author Aidan Boissonneault
 * @file completions.ts
 * @purpose Provides completions behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import type {
  LanguageCompletionItem,
  LanguagePosition,
  LanguageSymbol,
} from '../protocol/ILanguageServer.js';
import { offsetAt } from '../language/textPositions.js';
import {
  completionContextAt,
  completionSpecs,
  type CompletionContext,
} from './completion-specs.js';

/** Produces context-aware snippets and symbols for the language server. */
export function completionItems(
  source: string,
  position: LanguagePosition,
  symbols: LanguageSymbol[],
): LanguageCompletionItem[] {
  const before = source.slice(0, offsetAt(source, position));
  const linePrefix = before.slice(before.lastIndexOf('\n') + 1);
  const context = completionContextAt(before, linePrefix);
  return completionSpecs(source, before, context, symbols).map(
    (spec, index) => ({
      label: spec.label,
      kind: completionKind(context, spec.symbol),
      ...(spec.insertText ? { insertText: spec.insertText } : {}),
      ...(spec.detail ? { detail: spec.detail } : {}),
      ...(spec.documentation ? { documentation: spec.documentation } : {}),
      ...(spec.insertText && /\$\{|\$[0-9]/.test(spec.insertText)
        ? { snippet: true }
        : {}),
      sortText: `${contextSort(context)}-${String(index).padStart(3, '0')}`,
    }),
  );
}

/**
 * Handles completion kind in the providers flow.
 */
function completionKind(
  context: CompletionContext,
  symbol?: LanguageSymbol,
): LanguageCompletionItem['kind'] {
  if (symbol) {
    if (symbol.kind === 'fn') return 'function';
    if (['var', 'env', 'font'].includes(symbol.kind)) return 'variable';
    if (symbol.kind === 'sketch') return 'reference';
    if (['plane', 'anchor'].includes(symbol.kind)) return 'field';
    return 'class';
  }
  if (context === 'surfaceRef' || context === 'rectPlantSide') return 'field';
  if (context === 'statement') return 'keyword';
  return 'text';
}

/**
 * Handles context sort in the providers flow.
 */
function contextSort(context: CompletionContext): string {
  const contextual: CompletionContext[] = [
    'surfaceRef',
    'rectPlantSide',
    'sketchName',
    'fromTarget',
    'placeTarget',
    'loopIterator',
  ];
  return contextual.includes(context)
    ? '1'
    : context === 'statement'
      ? '2'
      : '3';
}
