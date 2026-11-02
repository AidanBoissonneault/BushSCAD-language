/**
 * @author Aidan Boissonneault
 * @file eval-iterators.ts
 * @purpose Evaluates iterators for the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ForStatement } from '@bushscad/ir';
import type { EvalCtx, EvalValue } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';
import { evalExpr, evalNum } from './eval-expressions.js';

// Iterator types

/**
 * Iter item, including bindings and where bindings.
 */
interface IterItem {
  bindings: Map<string, EvalValue>;
  whereBindings?: Map<string, EvalValue>;
}

/**
 * Derives `ForIterator` from `ForStatement['iterator']` to preserve its type relationship in the
 * expressions layer.
 */
type ForIterator = ForStatement['iterator'];
/**
 * Derives `ForBinding` from `ForStatement['binding']` to preserve its type relationship in the
 * expressions layer.
 */
type ForBinding = ForStatement['binding'];
/**
 * The range variant of ForIterator, used for range iterator.
 */
type RangeIterator = Extract<ForIterator, { kind: 'range' }>;
/**
 * The grid variant of ForIterator, used for grid iterator.
 */
type GridIterator = Extract<ForIterator, { kind: 'grid' }>;
/**
 * The radial variant of ForIterator, used for radial iterator.
 */
type RadialIterator = Extract<ForIterator, { kind: 'radial' }>;
/**
 * The list variant of ForIterator, used for list iterator.
 */
type ListIterator = Extract<ForIterator, { kind: 'list' }>;
/**
 * The enumerate variant of ForIterator, used for enumerate iterator.
 */
type EnumerateIterator = Extract<ForIterator, { kind: 'enumerate' }>;

// Public API

/** Produce the list of binding maps for a for-loop statement. */
export function getIterations(stmt: ForStatement, ctx: EvalCtx): IterItem[] {
  switch (stmt.iterator.kind) {
    case 'range':
      return getRangeIterations(stmt.iterator, stmt.binding, ctx);
    case 'grid':
      return getGridIterations(stmt.iterator, stmt.binding, ctx);
    case 'radial':
      return getRadialIterations(stmt.iterator, stmt.binding, ctx);
    case 'list':
      return getListIterations(stmt.iterator, stmt.binding, ctx);
    case 'enumerate':
      return getEnumerateIterations(stmt.iterator, stmt.binding, ctx);
  }
}

// Iterator helpers

/**
 * Returns the first binding name that matches the requested condition.
 */
function firstBindingName(binding: ForBinding): string {
  return Array.isArray(binding) ? binding[0] : binding;
}

/**
 * Handles pair binding names in the expressions flow.
 */
function pairBindingNames(
  binding: ForBinding,
  fallback: string,
): [string, string] {
  return Array.isArray(binding)
    ? (binding as [string, string])
    : [binding, fallback];
}

/**
 * Returns range iterations from the supplied input.
 */
function getRangeIterations(
  iter: RangeIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): IterItem[] {
  const errorsBeforeValues = ctx.errors.length;
  const start = iter.start !== undefined ? evalNum(iter.start, ctx) : 0;
  const end = evalNum(iter.end, ctx);
  const step = iter.step !== undefined ? evalNum(iter.step, ctx) : 1;
  if (ctx.errors.length !== errorsBeforeValues) return [];
  if (step <= 0) {
    addError(
      ctx,
      'range() step must be a finite positive number',
      iter.step?.span ?? iter.end.span,
    );
    return [];
  }
  const name = firstBindingName(binding);
  const items: IterItem[] = [];
  for (let i = start; i < end; ) {
    const next = i + step;
    if (next <= i) {
      addError(
        ctx,
        'range() step is too small to advance the current value',
        iter.step?.span ?? iter.end.span,
      );
      return [];
    }
    items.push({ bindings: new Map([[name, i]]) });
    i = next;
  }
  return items;
}

/**
 * Returns grid iterations from the supplied input.
 */
function getGridIterations(
  iter: GridIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): IterItem[] {
  const cols = Math.round(evalNum(iter.cols, ctx));
  const rows = Math.round(evalNum(iter.rows, ctx));
  const spacingX = evalGridSpacing(iter.spacingX, iter.spacing, ctx);
  const spacingY = evalGridSpacing(iter.spacingY, iter.spacing, ctx);
  const [nameI, nameJ] = pairBindingNames(binding, '_j');
  const hasSpacing = spacingX !== 0 || spacingY !== 0;
  const items: IterItem[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      items.push(
        gridIterationItem(
          nameI,
          nameJ,
          col,
          row,
          spacingX,
          spacingY,
          hasSpacing,
        ),
      );
    }
  }
  return items;
}

/**
 * Evaluates grid spacing with the current evaluation context.
 */
function evalGridSpacing(
  axisSpacing: import('@bushscad/ir').Expr | undefined,
  sharedSpacing: import('@bushscad/ir').Expr | undefined,
  ctx: EvalCtx,
): number {
  if (axisSpacing) return evalNum(axisSpacing, ctx);
  return sharedSpacing ? evalNum(sharedSpacing, ctx) : 0;
}

/**
 * Handles grid iteration item in the expressions flow.
 */
function gridIterationItem(
  nameI: string,
  nameJ: string,
  col: number,
  row: number,
  spacingX: number,
  spacingY: number,
  hasSpacing: boolean,
): IterItem {
  const item: IterItem = {
    bindings: new Map<string, EvalValue>([
      [nameI, spacingX !== 0 ? col * spacingX : col],
      [nameJ, spacingY !== 0 ? row * spacingY : row],
    ]),
  };
  if (hasSpacing) {
    item.whereBindings = new Map<string, EvalValue>([
      [nameI, col],
      [nameJ, row],
    ]);
  }
  return item;
}

/**
 * Returns radial iterations from the supplied input.
 */
function getRadialIterations(
  iter: RadialIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): IterItem[] {
  const count = Math.round(evalNum(iter.count, ctx));
  const start = iter.start !== undefined ? evalNum(iter.start, ctx) : 0;
  const sweep = iter.sweep !== undefined ? evalNum(iter.sweep, ctx) : 360;
  const name = firstBindingName(binding);
  const items: IterItem[] = [];
  for (let k = 0; k < count; k++) {
    items.push({ bindings: new Map([[name, start + k * (sweep / count)]]) });
  }
  return items;
}

/**
 * Returns list iterations from the supplied input.
 */
function getListIterations(
  iter: ListIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): IterItem[] {
  const list = evalExpr(iter.expr, ctx);
  const vals = Array.isArray(list) ? list : [list];
  const items: IterItem[] = [];
  for (const item of vals) {
    const bindings = bindListItem(binding, item, ctx, iter.expr.span);
    if (!bindings) return [];
    items.push({ bindings });
  }
  return items;
}

/**
 * Handles bind list item in the expressions flow.
 */
function bindListItem(
  binding: ForBinding,
  item: EvalValue,
  ctx: EvalCtx,
  span: import('@bushscad/ir').ASTSourceSpan,
): Map<string, EvalValue> | null {
  const bindings = new Map<string, EvalValue>();
  if (!Array.isArray(binding)) {
    bindings.set(binding, item);
  } else {
    if (!isTwoValueList(item)) {
      addError(
        ctx,
        'A two-name list loop requires each item to contain exactly two values',
        span,
      );
      return null;
    }
    bindings.set(binding[0], item[0]);
    bindings.set(binding[1], item[1]);
  }
  return bindings;
}

/**
 * Returns whether the input meets the `two value list` condition.
 */
function isTwoValueList(item: EvalValue): item is [EvalValue, EvalValue] {
  return Array.isArray(item) && item.length === 2;
}

/**
 * Returns enumerate iterations from the supplied input.
 */
function getEnumerateIterations(
  iter: EnumerateIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): IterItem[] {
  const list = evalExpr(iter.expr, ctx);
  const vals = Array.isArray(list) ? list : [list];
  return vals.map((item, idx) => ({
    bindings: bindEnumeratedItem(binding, item, idx),
  }));
}

/**
 * Handles bind enumerated item in the expressions flow.
 */
function bindEnumeratedItem(
  binding: ForBinding,
  item: EvalValue,
  idx: number,
): Map<string, EvalValue> {
  const bindings = new Map<string, EvalValue>();
  if (Array.isArray(binding)) {
    bindings.set(binding[0], idx);
    bindings.set(binding[1], item);
  } else {
    bindings.set(binding, item);
  }
  return bindings;
}
