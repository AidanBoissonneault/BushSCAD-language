import type { ComponentStatement } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveSketch } from '../../../sketch/sketch.js';

/**
 * Resolves body sketch against the current scope and reports unresolved references.
 */
export function resolveBodySketch(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const sketch = stmt as Extract<ComponentStatement, { kind: 'sketch' }>;
  resolveSketch(sketch, scope, state);
  scope.define(sketch.name, 'sketch');
}
