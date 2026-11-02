/**
 * @author Aidan Boissonneault
 * @file rectanglePlantCompletions.ts
 * @purpose Provides rectangle plant completions behavior for the providers in language server package.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import type { LanguageCompletionItem } from '../protocol/ILanguageServer.js';

const RECTANGLE_PLANT_SIDES = ['bottom', 'right', 'top', 'left'] as const;

/**
 * Detects the side selector that follows a compact rectangle plant suffix.
 * `plant` also prefixes named path lines, so completion must distinguish the
 * rectangle postfix before offering canonical rectangle sides. Parsing a
 * completed copy of the prefix follows real expression precedence, including
 * parentheses and Boolean rejection, without maintaining a second grammar.
 */
export function isRectanglePlantSideContext(textBeforeCursor: string): boolean {
  const suffix = /\bplant\s+[A-Za-z_]*$/.exec(textBeforeCursor);
  if (!suffix) return false;
  const completed = `${textBeforeCursor.slice(0, suffix.index)}plant bottom;`;
  const result = parse(completed, 'rectangle-plant-completion.bscd');
  if (result.errors.length > 0) return false;
  const statement = result.ast.statements.at(-1);
  return (
    statement?.kind === 'sketch' &&
    containsPlantedRectangle(statement.primitive)
  );
}

/** Matches only a rectangle beneath grammar-transparent local placements. */
function containsPlantedRectangle(primitive: SketchPrimitive): boolean {
  if (primitive.kind === 'rect') return primitive.plant === 'bottom';
  return (
    primitive.kind === 'sketchAt' &&
    containsPlantedRectangle(primitive.primitive)
  );
}

/** Returns the four canonical sides accepted by a planted rectangle. */
export function rectanglePlantSideCompletionItems(): LanguageCompletionItem[] {
  return RECTANGLE_PLANT_SIDES.map((label) => ({
    label,
    kind: 'field',
    detail: 'Rectangle plant side',
  }));
}
