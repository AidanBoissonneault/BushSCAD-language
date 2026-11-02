/**
 * @author Aidan Boissonneault
 * @file graph-lowering-support.ts
 * @purpose Provides graph lowering support behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRPartBoundary } from '@bushscad/ir';

/**
 * Type used for indexed op.
 */
export type IndexedOp = Readonly<{
  op: Exclude<IROp, IRPartBoundary>;
  index: number;
}>;

/**
 * Type used for part group.
 */
export type PartGroup = Readonly<{
  name: string;
  boundary?: IRPartBoundary;
  ops: readonly IndexedOp[];
}>;

/**
 * Type used for producer.
 */
export type Producer = Readonly<{
  nodeId: string;
  resource: string;
  partName: string;
  recipeDigest?: string;
}>;

/** Partitions the flat classic IR stream without changing authored order. */
export function partitionProgram(ops: readonly IROp[]): PartGroup[] {
  const groups: {
    name: string;
    boundary?: IRPartBoundary;
    ops: IndexedOp[];
  }[] = [];
  let current: (typeof groups)[number] | undefined;
  ops.forEach((op, index) => {
    if (op.kind === 'part') {
      current = { name: op.name, boundary: op, ops: [] };
      groups.push(current);
    } else {
      if (!current) {
        current = { name: '__default__', ops: [] };
        groups.push(current);
      }
      current.ops.push({ op, index });
    }
  });
  return groups;
}

/**
 * Handles semantic key in the pipeline parallel compilation flow.
 */
export function semanticKey(
  entrypoint: string,
  partName: string,
  op: Exclude<IROp, IRPartBoundary>,
  index: number,
): string {
  return `${entrypoint}|${partName}|${index}|${op.kind}|${op.span.file}:${op.span.line}:${op.span.col}`;
}

/**
 * Dispatches the operation to its matching action handler.
 */
export function operationLabel(
  op: IROp,
  outputs: readonly string[],
  index: number,
): string {
  return outputs.length > 0
    ? `${op.kind}:${outputs.join(',')}`
    : `${op.kind}#${index}`;
}

/**
 * Handles next entity resource in the pipeline parallel compilation flow.
 */
export function nextEntityResource(
  partName: string,
  name: string,
  revisions: Map<string, number>,
): string {
  const key = scoped(partName, name);
  const revision = (revisions.get(key) ?? -1) + 1;
  revisions.set(key, revision);
  return `entity:${partName}:${name}@${revision}`;
}

/**
 * Handles dependency recipe map in the pipeline parallel compilation flow.
 */
export function dependencyRecipeMap(
  partName: string,
  recipes: ReadonlyMap<string, string>,
): Map<string, string> {
  const result = new Map<string, string>();
  const prefix = `${partName}:`;
  for (const [key, digest] of recipes) {
    if (key.startsWith(prefix)) result.set(key.slice(prefix.length), digest);
  }
  return result;
}

/**
 * Handles scoped in the pipeline parallel compilation flow.
 */
export function scoped(partName: string, name: string): string {
  return `${partName}:${name}`;
}

/**
 * Handles global name in the pipeline parallel compilation flow.
 */
export function globalName(name: string): string {
  return `global:${name}`;
}
