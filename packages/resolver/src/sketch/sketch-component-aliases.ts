/**
 * @author Aidan Boissonneault
 * @file sketch-component-aliases.ts
 * @purpose Provides sketch component aliases behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from '@bushscad/ir';
import { addError } from '../core/errors.js';
import type { State } from '../core/types.js';

/**
 * Entry in alias, including path and span.
 */
type AliasEntry = { path: string; span: SketchPrimitive['span'] };

/** Diagnoses component paths repeated across Boolean sketch branches. */
export function validateBooleanComponentAliases(
  primitive: Extract<SketchPrimitive, { kind: 'sketchBoolean' }>,
  state: State,
): void {
  const left = new Set(
    componentAliases(primitive.left).map((entry) => entry.path),
  );
  for (const alias of componentAliases(primitive.right)) {
    if (!left.has(alias.path)) continue;
    addError(
      state,
      `Duplicate sketch component alias '${alias.path}'`,
      alias.span,
    );
  }
}

/**
 * Builds the component data required by the current operation.
 */
function componentAliases(
  primitive: SketchPrimitive,
  parent: readonly string[] = [],
): AliasEntry[] {
  if (primitive.kind === 'sketchAlias') {
    const path = [...parent, primitive.name];
    return [
      { path: path.join('.'), span: primitive.nameSpan },
      ...componentAliases(primitive.primitive, path),
    ];
  }
  if (primitive.kind === 'sketchBoolean') {
    return [
      ...componentAliases(primitive.left, parent),
      ...componentAliases(primitive.right, parent),
    ];
  }
  if (
    primitive.kind === 'sketchAt' ||
    primitive.kind === 'sketchConstruction' ||
    primitive.kind === 'sketchOffset' ||
    primitive.kind === 'sketchFillet'
  ) {
    return componentAliases(primitive.primitive, parent);
  }
  return [];
}
