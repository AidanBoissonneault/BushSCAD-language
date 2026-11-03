/**
 * @author Aidan Boissonneault
 * @file catalog.ts
 * @purpose Provides catalog behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import { controlHelp } from './control-help.js';
import { declarationHelp } from './declaration-help.js';
import { fitHelp } from './fit-help.js';
import { moduleHelp } from './module-help.js';
import { placementHelp } from './placement-help.js';
import { referenceHelp } from './reference-help.js';
import { rotationHelp } from './rotation-help.js';
import { sketchHelp } from './sketch-help.js';
import { solidHelp } from './solid-help.js';
import type { LanguageHelpEntry } from './types.js';
import { validationHelp } from './validation-help.js';
import { valueHelp } from './value-help.js';
import { drawingHelp } from './drawing-help.js';
import { jointHelp } from './joint-help.js';

/** Combines context-specific meanings without losing overloaded command documentation. */
function mergeCatalogs(
  ...catalogs: Record<string, LanguageHelpEntry>[]
): Record<string, LanguageHelpEntry> {
  const result: Record<string, LanguageHelpEntry> = {};
  for (const catalog of catalogs) {
    for (const [word, next] of Object.entries(catalog))
      result[word] = mergeCatalogEntry(result[word], next);
  }
  return result;
}

/**
 * Combines one pair of help entries without duplicating the shared content.
 */
function mergeCatalogEntry(
  prior: LanguageHelpEntry | undefined,
  next: LanguageHelpEntry,
): LanguageHelpEntry {
  if (!prior) return next;
  return {
    summary: unique([prior.summary, next.summary]).join('\n\n'),
    signatures: unique([...prior.signatures, ...next.signatures]),
    parameters: [...(prior.parameters ?? []), ...(next.parameters ?? [])],
    behavior: unique([...(prior.behavior ?? []), ...(next.behavior ?? [])]),
    examples: unique([...prior.examples, ...next.examples]),
    related: unique([...(prior.related ?? []), ...(next.related ?? [])]),
  };
}

/**
 * Removes duplicate values while preserving their first occurrence.
 */
function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export const languageHelp = mergeCatalogs(
  declarationHelp,
  moduleHelp,
  controlHelp,
  placementHelp,
  rotationHelp,
  referenceHelp,
  valueHelp,
  sketchHelp,
  solidHelp,
  validationHelp,
  fitHelp,
  drawingHelp,
  jointHelp,
);

/** Renders one verified help entry as portable Markdown for the language server. */
export function formatLanguageHelp(entry: LanguageHelpEntry): string {
  const sections = [
    entry.summary,
    '**Syntax**',
    `\`\`\`bushscad\n${entry.signatures.join('\n')}\n\`\`\``,
  ];
  if (entry.parameters?.length) {
    sections.push(
      '**Arguments**',
      entry.parameters
        .map((parameter) => `- \`${parameter.name}\`: ${parameter.description}`)
        .join('\n'),
    );
  }
  if (entry.behavior?.length)
    sections.push(
      '**Behavior and limits**',
      entry.behavior.map((note) => `- ${note}`).join('\n'),
    );
  sections.push(
    '**Examples**',
    ...entry.examples.map((example) => `\`\`\`bushscad\n${example}\n\`\`\``),
  );
  if (entry.related?.length)
    sections.push(
      `See also: ${entry.related.map((word) => `\`${word}\``).join(', ')}.`,
    );
  return sections.join('\n\n');
}

export const languageDocumentation: Record<string, string> = Object.fromEntries(
  Object.entries(languageHelp).map(([word, entry]) => [
    word,
    formatLanguageHelp(entry),
  ]),
);

/** Returns authored help only; unknown words do not get a generic construct tooltip. */
export function languageHover(word: string): string[] | null {
  return Object.hasOwn(languageDocumentation, word)
    ? [`\`${word}\``, languageDocumentation[word]]
    : null;
}

/** Finds help for snippet labels while retaining distinct meaning for compound labels. */
export function completionDocumentation(label: string): string | undefined {
  if (Object.hasOwn(languageDocumentation, label))
    return languageDocumentation[label];
  const words = unique(label.split(/[ .]/)).filter((word) =>
    Object.hasOwn(languageDocumentation, word),
  );
  return words.length
    ? words
        .map((word) => `### \`${word}\`\n\n${languageDocumentation[word]}`)
        .join('\n\n')
    : undefined;
}
