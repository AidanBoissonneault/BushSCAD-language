/**
 * @author Aidan Boissonneault
 * @file group-build-state.ts
 * @purpose Provides group build state behavior for the bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { Workplane } from '@bushscad/ir';
import type { GroupBuildState } from './bridge-types.js';
import { FaceLabelMap } from '../topology/face-labels.js';
import type { OcctBuildTrace } from '../operations/build-trace.js';

/**
 * Creates the mutable state owned by one OCCT part-group build.
 * Production orchestration and focused topology tests need the same complete
 * state shape. Keeping construction here prevents newly added maps or queues
 * from drifting between callers.
 */
export function createGroupBuildState(
  globalLabels: FaceLabelMap,
  workplane: Workplane,
  partName = '__default__',
  trace?: OcctBuildTrace,
): GroupBuildState {
  const partSolidOwner = partName === '__default__' ? null : partName;
  return {
    trace,
    interactionSelectionCounts: new Map(),
    interactionSelectionValues: new Map(),
    labelMap: new FaceLabelMap(globalLabels),
    globalLabels,
    declaredShapeNames: new Set(),
    defaultWorkplane: workplane,
    sketchPrimitives: new Map(),
    sketchFaces: new Map(),
    sketchWires: new Map(),
    sketchAxes: new Map(),
    surfaceBoundSketches: new Map(),
    pathWires: new Map(),
    surfaceShapes: new Map(),
    surfaceNormals: new Map(),
    surfaceMaterials: new Map(),
    bodyShapes: new Map(),
    bodyMaterials: new Map(),
    bodyOwners: new Map(),
    bodyEdgeModes: new Map(),
    bodyFrames: new Map(),
    bodyAttachmentPlanes: new Map(),
    partSolidOwner,
    partSolid: null,
    partSolidAliases: new Set(partSolidOwner ? [partSolidOwner] : []),
    partSolidComponents: new Map(),
    partSolidAliasComponents: new Map(),
    partSolidAliasShapes: new Map(),
    partSolidAliasAttachmentPlanes: new Map(),
    solidCutAliases: new Map(),
    preservedPartComponents: new Set(),
    pendingModifiers: [],
    modifierValidations: [],
    fitMetadata: new Map(),
    hardwareVisuals: [],
    debugBlendEdgeMeshes: [],
  };
}
