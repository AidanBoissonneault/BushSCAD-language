/** Owns drawing declaration resolution behavior. */
import type { TopLevelStatement } from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { addError } from '../../core/errors.js';

/**
 * Resolves drawing against the current scope and reports unresolved references.
 */
export function resolveDrawing(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const drawing = stmt as Extract<TopLevelStatement, { kind: 'drawing' }>;
  /**
   * Resolves obj name against the current scope and reports unresolved references.
   */
  const resolveObjName = (name: string) => scope.lookup(name.split('.')[0]);
  if (drawing.view.objName && resolveObjName(drawing.view.objName) === null) {
    addError(
      state,
      `Undefined object '${drawing.view.objName}' in drawing view`,
      drawing.view.span,
    );
  }
  for (const dim of drawing.dimensions) {
    resolveDrawingDimension(dim, resolveObjName, state);
  }
}

/**
 * Resolves drawing dimension against the current scope and reports unresolved references.
 */
export function resolveDrawingDimension(
  dim: Extract<TopLevelStatement, { kind: 'drawing' }>['dimensions'][number],
  resolveObjName: (name: string) => string | null,
  state: State,
): void {
  if (dim.ref.kind === 'obj_extent') {
    if (resolveObjName(dim.ref.objName) === null) {
      addError(
        state,
        `Undefined object '${dim.ref.objName}' in dimension`,
        dim.span,
      );
    }
    return;
  }
  if (resolveObjName(dim.ref.fromObjName) === null) {
    addError(
      state,
      `Undefined object '${dim.ref.fromObjName}' in dimension`,
      dim.span,
    );
  }
  if (resolveObjName(dim.ref.toObjName) === null) {
    addError(
      state,
      `Undefined object '${dim.ref.toObjName}' in dimension`,
      dim.span,
    );
  }
}
