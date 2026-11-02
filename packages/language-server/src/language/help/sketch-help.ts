/**
 * @author Aidan Boissonneault
 * @file sketch-help.ts
 * @purpose Provides sketch help behavior for the language help in language server package.
 * @last-edited October 6, 2026
 */

import { sketchConstraintHelp } from './sketch-constraint-help.js';
import { sketchPathHelp } from './sketch-path-help.js';
import { sketchPrimitiveHelp } from './sketch-primitive-help.js';
import { sketchWrapHelp } from './sketch-wrap-help.js';
import type { LanguageHelpEntry } from './types.js';

export const sketchHelp: Record<string, LanguageHelpEntry> = {
  ...sketchPrimitiveHelp,
  ...sketchPathHelp,
  ...sketchConstraintHelp,
  ...sketchWrapHelp,
};
