/**
 * @author Aidan Boissonneault
 * @file dependency-names.ts
 * @purpose Provides dependency names behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRPlacement } from '@bushscad/ir';
import { parseFaceRef } from '../core/program-utils.js';
import type { PartGroup } from '../core/program-utils.js';

/**
 * Handles group dependency names in the topology flow.
 */
export function groupDependencyNames(
  group: PartGroup,
  explicitPartNames: Set<string>,
): Set<string> {
  const deps = new Set<string>();
  const localObjectNames = new Set(
    group.ops.flatMap((op) =>
      op.kind === 'extrude' ||
      op.kind === 'cut' ||
      op.kind === 'solid_cut' ||
      op.kind === 'solidPrimitive'
        ? [op.objName]
        : [],
    ),
  );
  /**
   * Adds placement to its owning collection.
   */
  const addPlacement = (placement: IRPlacement | null | undefined): void => {
    if (!placement) return;
    const root = parseFaceRef(placement.faceRef).objName;
    if (localObjectNames.has(root)) return;
    if (root !== group.name && explicitPartNames.has(root)) deps.add(root);
  };

  for (const op of group.ops) {
    switch (op.kind) {
      case 'sketch':
        addPlacement(op.placement);
        break;
      case 'extrude':
        addPlacement(op.from);
        break;
      case 'cut':
        addPlacement(op.from);
        break;
      case 'solid_cut':
        addPlacement(op.from);
        break;
      case 'solidPrimitive':
        addPlacement(op.placement);
        break;
      case 'rotate':
        if (typeof op.around !== 'string') addPlacement(op.around);
        break;
    }
  }

  return deps;
}
