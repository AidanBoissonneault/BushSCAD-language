/**
 * @author Aidan Boissonneault
 * @file native-boolean-dependencies.ts
 * @purpose Provides native boolean dependencies behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp, NativeBooleanBatchRejection } from '@bushscad/ir';
import { operationAccess } from '@bushscad/evaluator';
import type { PartGroup } from './graph-lowering-support.js';

/** Indexes source-ordered producers used by the native batch proof. */
export function nativeBooleanProducerIndices(
  group: PartGroup,
): Map<string, number[]> {
  const result = new Map<string, number[]>();
  group.ops.forEach(({ op }, opIndex) => {
    for (const output of operationAccess(op).schedulingOutputs) {
      const indices = result.get(output) ?? [];
      indices.push(opIndex);
      result.set(output, indices);
    }
  });
  return result;
}

/** Returns true when a named dependency is available before an operation. */
export function nativeBooleanHasProducerBefore(
  producers: ReadonlyMap<string, readonly number[]>,
  name: string,
  opIndex: number,
): boolean {
  return producers.get(name)?.some((index) => index < opIndex) === true;
}

/** Detects dependencies produced inside a proposed immutable batch window. */
export function nativeBooleanHasProducerInRange(
  producers: ReadonlyMap<string, readonly number[]>,
  name: string,
  start: number,
  end: number,
): boolean {
  return (
    producers.get(name)?.some((index) => index >= start && index < end) === true
  );
}

/** Normalizes scheduler inputs to their source object names. */
export function nativeBooleanInputNames(
  op: Exclude<IROp, { kind: 'part' }>,
): readonly string[] {
  return operationAccess(op).schedulingInputs.map(nativeBooleanRootName);
}

/** Removes topology-selector suffixes while retaining the object identity. */
export function nativeBooleanRootName(reference: string): string {
  return reference.split('.')[0] ?? reference;
}

/** Produces one stable planner diagnostic for an excluded boolean operation. */
export function nativeBooleanRejection(
  partName: string,
  opIndex: number,
  opKind: NativeBooleanBatchRejection['opKind'],
  opName: string,
  reason: string,
): NativeBooleanBatchRejection {
  return { partName, opIndex, opKind, opName, reason };
}

/** Serializes material identity for compatibility comparisons. */
export function nativeBooleanMaterialKey(material: unknown): string {
  return JSON.stringify(material ?? null);
}
