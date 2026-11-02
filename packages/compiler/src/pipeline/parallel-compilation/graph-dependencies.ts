/**
 * @author Aidan Boissonneault
 * @file graph-dependencies.ts
 * @purpose Provides graph dependencies behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraphEdgeKind } from '@bushscad/ir';
import { GraphAssembly } from './graph-assembly.js';
import { globalName, scoped, type Producer } from './graph-lowering-support.js';

/**
 * Type used for input for pending.
 */
export type PendingInput = Readonly<{
  name: string;
  partName: string;
  to: string;
  kind: CompilationGraphEdgeKind;
}>;

/** Connects immediately available inputs and records forward references. */
export function connectInputs(
  assembly: GraphAssembly,
  names: readonly string[],
  outputs: readonly string[],
  topologySensitive: boolean,
  partName: string,
  to: string,
  producers: ReadonlyMap<string, Producer>,
  pending: PendingInput[],
): void {
  for (const name of names) {
    const producer =
      producers.get(scoped(partName, name)) ?? producers.get(globalName(name));
    if (!producer && outputs.includes(name)) continue;
    const kind = topologySensitive ? 'topology' : 'shape';
    if (producer)
      assembly.addEdge(producer.nodeId, to, kind, producer.resource);
    else pending.push({ name, partName, to, kind });
  }
}

/** Resolves forward and cross-part inputs after all part outputs are known. */
export function resolvePendingInputs(
  assembly: GraphAssembly,
  pending: readonly PendingInput[],
  producers: ReadonlyMap<string, Producer>,
  finalParts: ReadonlyMap<string, string>,
  partDeps: ReadonlyMap<string, Set<string>>,
): void {
  for (const input of pending) {
    const producer =
      producers.get(scoped(input.partName, input.name)) ??
      producers.get(globalName(input.name));
    if (producer) {
      assembly.addEdge(
        producer.nodeId,
        input.to,
        input.kind,
        producer.resource,
      );
      if (producer.partName !== input.partName)
        partDeps.get(input.partName)?.add(producer.partName);
      continue;
    }
    const finalPart = finalParts.get(input.name);
    if (finalPart && input.name !== input.partName) {
      assembly.addEdge(
        finalPart,
        input.to,
        'topology',
        `part:${input.name}:final`,
      );
      partDeps.get(input.partName)?.add(input.name);
      continue;
    }
    addExternalSource(assembly, input);
  }
}

/**
 * Adds external source to its owning collection.
 */
function addExternalSource(assembly: GraphAssembly, input: PendingInput): void {
  const resource = `external:${input.partName}:${input.name}`;
  const sourceId = assembly.addNode({
    key: resource,
    kind: 'source',
    label: resource,
    sourceOrder: -1,
    polarity: 'neutral',
    topologySensitive: false,
    orderSensitive: false,
    continuation: false,
    cacheSafe: false,
    estimatedCost: 'metadata',
    writes: [resource],
  });
  assembly.addEdge(sourceId, input.to, 'scope', resource);
}
