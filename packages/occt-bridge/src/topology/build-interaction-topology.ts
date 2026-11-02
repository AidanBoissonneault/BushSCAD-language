/**
 * @author Aidan Boissonneault
 * @file build-interaction-topology.ts
 * @purpose Builds interaction topology for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  InteractionEntity,
  InteractionMeshTopology,
  InteractionSnapshot,
} from '@bushscad/ir';
import type { BuiltPart, OC } from '../bridge/bridge-types.js';
import {
  attachUnmatchedReferencePoints,
  extractInteractionMeshTopology,
} from '../mesh/interaction-mesh-topology.js';
import { createInteractionTopologyBindings } from './interaction-bindings.js';

/** Builds topology ownership in the same mesh order returned by the bridge. */
export function buildInteractionTopology(
  oc: OC,
  parts: readonly BuiltPart[],
  snapshot: InteractionSnapshot | undefined,
): InteractionMeshTopology[] {
  if (!snapshot) return [];
  const topology: InteractionMeshTopology[] = [];
  let meshIndex = 0;
  for (const part of parts) {
    const partEntity = findEntity(snapshot, 'part', part.group.name);
    const bindings = createInteractionTopologyBindings(
      oc,
      snapshot,
      part.labelMap,
      partEntity?.id,
    );
    const partTopology: InteractionMeshTopology[] = [];
    for (const materialShape of part.materialShapes) {
      const objectEntity = materialShape.bodyName
        ? findObject(snapshot, materialShape.bodyName)
        : undefined;
      partTopology.push(
        extractInteractionMeshTopology(oc, materialShape.shape, {
          meshIndex,
          partEntityId: partEntity?.id ?? `unlinked-part:${part.group.name}`,
          ...(objectEntity ? { objectEntityId: objectEntity.id } : {}),
          bindings,
        }),
      );
      meshIndex += 1;
    }
    topology.push(
      ...attachUnmatchedReferencePoints(
        partTopology,
        bindings.unmatchedReferencePoints(),
      ),
    );
    meshIndex += part.hardwareVisuals.length + part.debugBlendEdgeMeshes.length;
  }
  return topology;
}

/**
 * Returns entity from the supplied input.
 */
function findEntity(
  snapshot: InteractionSnapshot,
  kind: InteractionEntity['kind'],
  name: string,
): InteractionEntity | undefined {
  return snapshot.entities.find(
    (entity) => entity.kind === kind && entity.name === name,
  );
}

/**
 * Returns object from the supplied input.
 */
function findObject(
  snapshot: InteractionSnapshot,
  name: string,
): InteractionEntity | undefined {
  return snapshot.entities.find(
    (entity) =>
      entity.name === name &&
      ['object', 'generated-instance', 'surface', 'imported'].includes(
        entity.kind,
      ),
  );
}
