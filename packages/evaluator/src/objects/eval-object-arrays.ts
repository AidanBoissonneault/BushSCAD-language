/**
 * @author Aidan Boissonneault
 * @file eval-object-arrays.ts
 * @purpose Evaluates object arrays for the objects in evaluator package.
 * @last-edited October 6, 2026
 */

import type { EvalCtx } from '../core/eval-types.js';
import { isFaceRefValue } from '../core/eval-types.js';

/**
 * Resolves an object target that may name an array of generated objects.
 * Array-expanded declarations bind the declared source name to every generated
 * object in order. Object-level operations should apply to all of them when no
 * explicit indexed `@name[index]` reference is used.
 */
export function objectTargetNames(target: string, ctx: EvalCtx): string[] {
  const parsed = parseIndexedTarget(target);
  const value = ctx.values.get(parsed.name);
  if (Array.isArray(value)) {
    const names = value.flatMap((item) => {
      if (typeof item === 'string') return [item];
      if (isFaceRefValue(item)) return [item.label];
      return [];
    });
    if (names.length > 0) return pickTargetNames(names, parsed.index);
  }
  if (typeof value === 'string') return pickTargetNames([value], parsed.index);
  if (isFaceRefValue(value))
    return pickTargetNames([value.label], parsed.index);
  return [ctx.names.get(parsed.name) ?? parsed.name];
}

/**
 * Parses indexed target from the supplied source into the objects representation.
 */
function parseIndexedTarget(target: string): {
  name: string;
  index: number | null;
} {
  const match = /^(.*)\[(\d+)\]$/.exec(target);
  if (!match) return { name: target, index: null };
  return { name: match[1] ?? target, index: Number(match[2]) };
}

/**
 * Handles pick target names in the objects flow.
 */
function pickTargetNames(names: string[], index: number | null): string[] {
  if (index === null) return names;
  return index >= 0 && index < names.length ? [names[index]!] : [];
}
