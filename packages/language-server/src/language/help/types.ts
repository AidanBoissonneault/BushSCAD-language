/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

/** Editor-neutral reference material shared by hover and completion providers. */
export type LanguageHelpEntry = {
  summary: string;
  signatures: string[];
  parameters?: { name: string; description: string }[];
  behavior?: string[];
  examples: string[];
  related?: string[];
};
