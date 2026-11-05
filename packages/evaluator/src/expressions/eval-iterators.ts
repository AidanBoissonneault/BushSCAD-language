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

/** One evaluated iterator item and its optional unscaled where bindings. */
interface IterItem {
  bindings: Map<string, EvalValue>;
  whereBindings?: Map<string, EvalValue>;
}

/** Derives `ForIterator` from the statement contract. */
type ForIterator = ForStatement['iterator'];
/** Derives `ForBinding` from the statement contract. */
type ForBinding = ForStatement['binding'];
/** The range variant of the source iterator. */
type RangeIterator = Extract<ForIterator, { kind: 'range' }>;
/** The list variant of the source iterator. */
type ListIterator = Extract<ForIterator, { kind: 'list' }>;
/** The range variant of the source iterator. */
type GridIterator = Extract<ForIterator, { kind: 'grid' }>;
/** The radial variant of the source iterator. */
type RadialIterator = Extract<ForIterator, { kind: 'radial' }>;
/** The enumerate variant of the source iterator. */
type EnumerateIterator = Extract<ForIterator, { kind: 'enumerate' }>;

type PreparedIterations =
  | {
      kind: 'range';
      range: { start: number; end: number; step: number };
      name: string;
    }
  | {
      kind: 'grid';
      cols: number;
      rows: number;
      nameI: string;
      nameJ: string;
      spacingX: number;
      spacingY: number;
      hasSpacing: boolean;
    }
  | {
      kind: 'radial';
      count: number;
      start: number;
      sweep: number;
      name: string;
    }
  | {
      kind: 'list';
      values: EvalValue[];
      binding: ForBinding;
      span: import('@bushscad/ir').ASTSourceSpan;
    }
  | {
      kind: 'enumerate';
      values: EvalValue[];
      binding: ForBinding;
    };

/** Materializes iterator bindings for loops that require indexed access. */
export function getIterations(stmt: ForStatement, ctx: EvalCtx): IterItem[] {
  const prepared = prepareIterations(stmt, ctx, false);
  if (!prepared) return [];
  const items: IterItem[] = [];
  forEachPreparedIteration(prepared, ctx, (item) => items.push(item));
  return items;
}

/** Visits iterator bindings one at a time to avoid retaining per-item maps. */
export function forEachIteration(
  stmt: ForStatement,
  ctx: EvalCtx,
  visit: (item: IterItem) => void,
): void {
  const prepared = prepareIterations(stmt, ctx, true);
  if (prepared) forEachPreparedIteration(prepared, ctx, visit);
}

/** Evaluates loop inputs and validates all iterator-level failures up front. */
function prepareIterations(
  stmt: ForStatement,
  ctx: EvalCtx,
  snapshotListValues: boolean,
): PreparedIterations | null {
  switch (stmt.iterator.kind) {
    case 'range':
      return prepareRange(stmt.iterator, stmt.binding, ctx);
    case 'grid':
      return prepareGrid(stmt.iterator, stmt.binding, ctx);
    case 'radial':
      return prepareRadial(stmt.iterator, stmt.binding, ctx);
    case 'list':
      return prepareList(stmt.iterator, stmt.binding, ctx, snapshotListValues);
    case 'enumerate':
      return prepareEnumerate(
        stmt.iterator,
        stmt.binding,
        ctx,
        snapshotListValues,
      );
  }
}

/** Evaluates and validates a range before exposing any loop bindings. */
function prepareRange(
  iterator: RangeIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): PreparedIterations | null {
  const range = evaluateRange(iterator, ctx);
  if (!range || !validateRangeProgress(range, iterator, ctx)) return null;
  return { kind: 'range', range, name: firstBindingName(binding) };
}

/** Evaluates grid dimensions and spacing once for the loop. */
function prepareGrid(
  iterator: GridIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): PreparedIterations {
  const cols = Math.round(evalNum(iterator.cols, ctx));
  const rows = Math.round(evalNum(iterator.rows, ctx));
  const spacingX = evalGridSpacing(iterator.spacingX, iterator.spacing, ctx);
  const spacingY = evalGridSpacing(iterator.spacingY, iterator.spacing, ctx);
  const [nameI, nameJ] = pairBindingNames(binding, '_j');
  return {
    kind: 'grid',
    cols,
    rows,
    nameI,
    nameJ,
    spacingX,
    spacingY,
    hasSpacing: spacingX !== 0 || spacingY !== 0,
  };
}

/** Evaluates the count and angular bounds for one radial loop. */
function prepareRadial(
  iterator: RadialIterator,
  binding: ForBinding,
  ctx: EvalCtx,
): PreparedIterations {
  return {
    kind: 'radial',
    count: Math.round(evalNum(iterator.count, ctx)),
    start: iterator.start !== undefined ? evalNum(iterator.start, ctx) : 0,
    sweep: iterator.sweep !== undefined ? evalNum(iterator.sweep, ctx) : 360,
    name: firstBindingName(binding),
  };
}

/** Evaluates and validates list items before any loop body can run. */
function prepareList(
  iterator: ListIterator,
  binding: ForBinding,
  ctx: EvalCtx,
  snapshotValues: boolean,
): PreparedIterations | null {
  const value = evalExpr(iterator.expr, ctx);
  const sourceValues = Array.isArray(value) ? value : [value];
  if (Array.isArray(binding) && !hasValidPairItems(sourceValues)) {
    addError(
      ctx,
      'A two-name list loop requires each item to contain exactly two values',
      iterator.expr.span,
    );
    return null;
  }
  const values = snapshotValues ? [...sourceValues] : sourceValues;
  return { kind: 'list', values, binding, span: iterator.expr.span };
}

/** Evaluates the value list for an enumerate loop. */
function prepareEnumerate(
  iterator: EnumerateIterator,
  binding: ForBinding,
  ctx: EvalCtx,
  snapshotValues: boolean,
): PreparedIterations {
  const value = evalExpr(iterator.expr, ctx);
  const sourceValues = Array.isArray(value) ? value : [value];
  return {
    kind: 'enumerate',
    values: snapshotValues ? [...sourceValues] : sourceValues,
    binding,
  };
}

/** Returns whether each two-name list item has exactly two values. */
function hasValidPairItems(values: readonly EvalValue[]): boolean {
  return values.every(isTwoValueList);
}

/** Dispatches prepared bindings without building an array of iteration items. */
function forEachPreparedIteration(
  prepared: PreparedIterations,
  ctx: EvalCtx,
  visit: (item: IterItem) => void,
): void {
  switch (prepared.kind) {
    case 'range':
      forEachRange(prepared, visit);
      return;
    case 'grid':
      forEachGrid(prepared, visit);
      return;
    case 'radial':
      forEachRadial(prepared, visit);
      return;
    case 'list':
      forEachList(prepared, ctx, visit);
      return;
    case 'enumerate':
      forEachEnumerate(prepared, visit);
  }
}

/** Visits one range value at a time after progress validation. */
function forEachRange(
  prepared: Extract<PreparedIterations, { kind: 'range' }>,
  visit: (item: IterItem) => void,
): void {
  for (
    let value = prepared.range.start;
    value < prepared.range.end;
    value += prepared.range.step
  ) {
    visit({ bindings: new Map([[prepared.name, value]]) });
  }
}

/** Visits grid cells in the established row-major order. */
function forEachGrid(
  prepared: Extract<PreparedIterations, { kind: 'grid' }>,
  visit: (item: IterItem) => void,
): void {
  for (let row = 0; row < prepared.rows; row++) {
    for (let col = 0; col < prepared.cols; col++) {
      visit(
        gridIterationItem(
          prepared.nameI,
          prepared.nameJ,
          col,
          row,
          prepared.spacingX,
          prepared.spacingY,
          prepared.hasSpacing,
        ),
      );
    }
  }
}

/** Visits each radial angle using the original count-based spacing formula. */
function forEachRadial(
  prepared: Extract<PreparedIterations, { kind: 'radial' }>,
  visit: (item: IterItem) => void,
): void {
  for (let index = 0; index < prepared.count; index++) {
    visit({
      bindings: new Map([
        [
          prepared.name,
          prepared.start + index * (prepared.sweep / prepared.count),
        ],
      ]),
    });
  }
}

/** Visits list values after validating their binding shape. */
function forEachList(
  prepared: Extract<PreparedIterations, { kind: 'list' }>,
  ctx: EvalCtx,
  visit: (item: IterItem) => void,
): void {
  for (const value of prepared.values) {
    const bindings = bindListItem(prepared.binding, value, ctx, prepared.span);
    if (bindings) visit({ bindings });
  }
}

/** Visits indexed values for an enumerate loop. */
function forEachEnumerate(
  prepared: Extract<PreparedIterations, { kind: 'enumerate' }>,
  visit: (item: IterItem) => void,
): void {
  prepared.values.forEach((value, index) => {
    visit({ bindings: bindEnumeratedItem(prepared.binding, value, index) });
  });
}

/** Returns the first binding name for a single- or pair-binding loop. */
function firstBindingName(binding: ForBinding): string {
  return Array.isArray(binding) ? binding[0] : binding;
}

/** Returns two binding names, using the established fallback for a single name. */
function pairBindingNames(
  binding: ForBinding,
  fallback: string,
): [string, string] {
  return Array.isArray(binding)
    ? (binding as [string, string])
    : [binding, fallback];
}

/** Evaluates the range bounds and rejects invalid or non-advancing steps. */
function evaluateRange(
  iter: RangeIterator,
  ctx: EvalCtx,
): { start: number; end: number; step: number } | null {
  const errorsBeforeValues = ctx.errors.length;
  const start = iter.start !== undefined ? evalNum(iter.start, ctx) : 0;
  const end = evalNum(iter.end, ctx);
  const step = iter.step !== undefined ? evalNum(iter.step, ctx) : 1;
  if (ctx.errors.length !== errorsBeforeValues) return null;
  if (step <= 0) {
    addError(
      ctx,
      'range() step must be a finite positive number',
      iter.step?.span ?? iter.end.span,
    );
    return null;
  }
  return { start, end, step };
}

/**
 * Checks range progress before the body runs, without retaining every value.
 *
 * Why:
 * Range errors must be reported before body side effects, while ordinary
 * loops should not allocate a second array proportional to their iteration
 * count.
 */
function validateRangeProgress(
  range: { start: number; end: number; step: number },
  iter: RangeIterator,
  ctx: EvalCtx,
): boolean {
  for (let value = range.start; value < range.end;) {
    const next = value + range.step;
    if (next <= value) {
      addError(
        ctx,
        'range() step is too small to advance the current value',
        iter.step?.span ?? iter.end.span,
      );
      return false;
    }
    value = next;
  }
  return true;
}

/** Evaluates an axis-specific spacing expression before shared spacing. */
function evalGridSpacing(
  axisSpacing: import('@bushscad/ir').Expr | undefined,
  sharedSpacing: import('@bushscad/ir').Expr | undefined,
  ctx: EvalCtx,
): number {
  if (axisSpacing) return evalNum(axisSpacing, ctx);
  return sharedSpacing ? evalNum(sharedSpacing, ctx) : 0;
}

/** Creates grid bindings while retaining unscaled coordinates for `where`. */
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

/** Binds a list item after pair-shape validation has completed. */
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

/** Returns whether a two-name list item contains exactly two values. */
function isTwoValueList(item: EvalValue): item is [EvalValue, EvalValue] {
  return Array.isArray(item) && item.length === 2;
}

/** Binds the index and value for one enumerate item. */
function bindEnumeratedItem(
  binding: ForBinding,
  item: EvalValue,
  index: number,
): Map<string, EvalValue> {
  const bindings = new Map<string, EvalValue>();
  if (Array.isArray(binding)) {
    bindings.set(binding[0], index);
    bindings.set(binding[1], item);
  } else {
    bindings.set(binding, item);
  }
  return bindings;
}
