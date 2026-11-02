/**
 * @author Aidan Boissonneault
 * @file completion-specs.ts
 * @purpose Provides completion specs behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import { completionDocumentation } from '../language/help/catalog.js';
import type { LanguageSymbol } from '../protocol/ILanguageServer.js';
import {
  BUSHSCAD_BUILTINS,
  BUSHSCAD_SURFACE_REFS,
  BUSHSCAD_WORKPLANES,
} from '../language/syntaxFacts.js';
import {
  BUSHSCAD_HELPER_SNIPPETS,
  BUSHSCAD_PRIMITIVE_SNIPPETS,
} from '../snippets/primitiveHelperSnippets.js';
import { BUSHSCAD_STATEMENT_COMPLETION_SPECS } from '../snippets/statementCompletionSpecs.js';
import { BUSHSCAD_TOP_LEVEL_SNIPPETS } from '../snippets/topLevelSnippets.js';
import {
  isRectanglePlantSideContext,
  rectanglePlantSideCompletionItems,
} from './rectanglePlantCompletions.js';
import { sketchBodyCompletionItems } from './sketchBodyCompletions.js';

/**
 * Accepted values for context for completion are 'surfaceRef', 'rectPlantSide', 'sketchName',
 * 'fromTarget', 'placeTarget', 'loopIterator', 'statement', and 'default'.
 */
export type CompletionContext =
  | 'surfaceRef'
  | 'rectPlantSide'
  | 'sketchName'
  | 'fromTarget'
  | 'placeTarget'
  | 'loopIterator'
  | 'statement'
  | 'default';

/**
 * Language completion spec, including display label, insert text, additional detail,
 * documentation, and symbol.
 */
export type LanguageCompletionSpec = {
  label: string;
  insertText?: string;
  detail?: string;
  documentation?: string;
  symbol?: LanguageSymbol;
};

/** Classifies source before a cursor for context-aware language completions. */
export function completionContextAt(
  text: string,
  linePrefix: string,
): CompletionContext {
  if (isRectanglePlantSideContext(text)) return 'rectPlantSide';
  if (/\.\s*[A-Za-z_]*$/.test(text)) return 'surfaceRef';
  if (/\b(?:extrude|cut|revolve|loft)\(\s*[A-Za-z_]*$/.test(text))
    return 'sketchName';
  if (/\bfrom\s+(?:[A-Za-z_][\w.]*)?$/.test(text)) return 'fromTarget';
  if (/\bplace\s+[A-Za-z_]\w*$/.test(text) || /\bplace\s*$/.test(text))
    return 'placeTarget';
  if (/\bin\s+[A-Za-z_]*$/.test(text)) return 'loopIterator';
  return /^\s*[A-Za-z_]*$/.test(linePrefix) ? 'statement' : 'default';
}

/**
 * Handles symbol specs in the providers flow.
 */
function symbolSpecs(symbols: LanguageSymbol[]): LanguageCompletionSpec[] {
  return symbols.map((symbol) => ({
    label: symbol.name,
    insertText: symbol.name,
    detail: symbol.detail,
    documentation: symbol.documentation,
    symbol,
  }));
}

/**
 * Removes duplicate values while preserving their first occurrence.
 */
function unique(specs: LanguageCompletionSpec[]): LanguageCompletionSpec[] {
  const seen = new Set<string>();
  return specs.filter((spec) => {
    if (seen.has(spec.label)) return false;
    seen.add(spec.label);
    return true;
  });
}

/** Returns editor-neutral snippets and symbols for one cursor context. */
export function completionSpecs(
  source: string,
  before: string,
  context: CompletionContext,
  symbols: LanguageSymbol[],
): LanguageCompletionSpec[] {
  return contextualCompletionSpecs(source, before, context, symbols).map(
    (spec) => {
      if (spec.symbol || spec.detail?.startsWith('Named body of sketch'))
        return spec;
      const help = completionDocumentation(spec.label);
      return help
        ? {
            ...spec,
            documentation: [spec.documentation, help]
              .filter(Boolean)
              .join('\n\n'),
          }
        : spec;
    },
  );
}

/** Keeps completion selection and ordering independent from documentation rendering. */
function contextualCompletionSpecs(
  source: string,
  before: string,
  context: CompletionContext,
  symbols: LanguageSymbol[],
): LanguageCompletionSpec[] {
  const surfaces = BUSHSCAD_SURFACE_REFS.map((label) => ({
    label,
    detail: 'Surface reference',
  }));
  switch (context) {
    case 'rectPlantSide':
      return rectanglePlantSideCompletionItems();
    case 'surfaceRef':
      return sketchBodyCompletionItems(source, before) ?? surfaces;
    case 'sketchName':
      return symbolSpecs(symbols.filter((symbol) => symbol.kind === 'sketch'));
    case 'fromTarget':
      return unique([
        ...symbolSpecs(
          symbols.filter((symbol) =>
            ['obj', 'part', 'plane', 'anchor'].includes(symbol.kind),
          ),
        ),
        {
          label: 'pos',
          insertText: '@${1:target}(${2:0}, ${3:0})',
          detail: 'Position from a face reference',
        },
      ]);
    case 'placeTarget':
      return symbolSpecs(
        symbols.filter((symbol) => ['fn', 'part'].includes(symbol.kind)),
      );
    case 'loopIterator':
      return BUSHSCAD_HELPER_SNIPPETS.filter((spec) =>
        ['range', 'grid', 'radial', 'enumerate'].includes(spec.label),
      );
    case 'statement':
      return unique([
        ...BUSHSCAD_TOP_LEVEL_SNIPPETS,
        ...BUSHSCAD_PRIMITIVE_SNIPPETS,
        ...BUSHSCAD_HELPER_SNIPPETS,
        ...BUSHSCAD_STATEMENT_COMPLETION_SPECS,
        ...symbolSpecs(symbols),
      ]);
    case 'default':
      return unique([
        ...BUSHSCAD_PRIMITIVE_SNIPPETS,
        ...BUSHSCAD_HELPER_SNIPPETS,
        ...BUSHSCAD_BUILTINS.map((label) => ({ label })),
        ...surfaces,
        ...BUSHSCAD_WORKPLANES.map((label) => ({
          label,
          detail: 'Workplane value',
        })),
        ...symbolSpecs(symbols),
      ]);
  }
}
