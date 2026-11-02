/**
 * @author Aidan Boissonneault
 * @file prepared-component-assembly.ts
 * @purpose Provides prepared component assembly behavior for the bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IRExtrude,
  IROp,
  IRRevolve,
  MaterialAppearance,
  PreparedComponentArtifact,
  SourceSpan,
} from '@bushscad/ir';
import type { GroupBuildState, OC } from './bridge-types.js';
import { deserializeNativeBrep } from './native-brep-artifacts.js';
import { makeDefaultAxis, type Vec3 } from '../core/geometry-utils.js';
import { occtError } from '../core/occt-errors.js';
import { primitiveGrowsFromPlane } from '../primitives/solid-primitives.js';
import { faceFrameFromAx2, type FaceFrame } from '../topology/face-labels.js';
import { workplaneFrame } from '../topology/frame-utils.js';
import { registerPrimitiveNamedEdgesForBody } from '../topology/primitive-named-edge-labels.js';
import type { SourceAttachmentPlane } from '../topology/source-edge-recovery.js';

/**
 * Type used for prepared component assembly.
 */
export type PreparedComponentAssembly = Readonly<{
  addBody: (
    name: string,
    shape: OC,
    frame: FaceFrame,
    material: MaterialAppearance | null,
    span?: SourceSpan,
    attachmentPlane?: SourceAttachmentPlane,
  ) => void;
  addExtrudedBody: (op: IRExtrude, shape: OC, axis: OC) => void;
  addBodyFromSketchAxis: (
    name: string,
    sketchName: string,
    shape: OC,
    material: MaterialAppearance | null,
    span?: SourceSpan,
  ) => void;
  revolveBodyFrame: (op: IRRevolve, axis: OC) => FaceFrame;
  revolveAxisVectors: (op: IRRevolve, axis: OC) => { point: Vec3; dir: Vec3 };
}>;

/** Returns the transferable output name for an eligible construction op. */
export function preparedComponentName(op: IROp): string | undefined {
  switch (op.kind) {
    case 'solidPrimitive':
    case 'extrude':
    case 'revolve':
    case 'radial_extrude':
    case 'loft':
    case 'sweep':
      return op.objName;
    default:
      return undefined;
  }
}

/** Rehydrates native BRep and replays authored semantic registration. */
export function restorePreparedComponent(
  oc: OC,
  state: GroupBuildState,
  op: IROp,
  artifact: PreparedComponentArtifact,
  assembly: PreparedComponentAssembly,
): void {
  const shape = deserializeNativeBrep(oc, artifact.brep);
  try {
    restoreByKind(oc, state, op, artifact, shape, assembly);
  } catch (error) {
    shape.delete?.();
    throw error;
  }
}

/**
 * Handles restore by kind in the bridge flow.
 */
function restoreByKind(
  oc: OC,
  state: GroupBuildState,
  op: IROp,
  artifact: PreparedComponentArtifact,
  shape: OC,
  assembly: PreparedComponentAssembly,
): void {
  switch (op.kind) {
    case 'solidPrimitive':
      restoreSolidPrimitive(op, shape, assembly);
      return;
    case 'extrude':
      restoreExtrude(oc, state, op, shape, assembly);
      return;
    case 'revolve':
      restoreRevolve(oc, state, op, shape, assembly);
      return;
    case 'radial_extrude':
      restoreSketchAxisBody(oc, state, op, shape, assembly, true);
      return;
    case 'sweep':
      restoreSketchAxisBody(oc, state, op, shape, assembly, false);
      return;
    case 'loft':
      restoreLoft(oc, state, op, shape, assembly);
      return;
    default:
      throw occtError(
        `Prepared component '${artifact.name}' has unsupported kind '${op.kind}'.`,
        op.span,
      );
  }
}

/**
 * Handles restore solid primitive in the bridge flow.
 */
function restoreSolidPrimitive(
  op: Extract<IROp, { kind: 'solidPrimitive' }>,
  shape: OC,
  assembly: PreparedComponentAssembly,
): void {
  assembly.addBody(
    op.objName,
    shape,
    workplaneFrame('XY'),
    op.material ?? null,
    op.span,
    primitiveGrowsFromPlane(op)
      ? { origin: [0, 0, 0], normal: [0, 0, 1] }
      : undefined,
  );
}

/**
 * Handles restore extrude in the bridge flow.
 */
function restoreExtrude(
  oc: OC,
  state: GroupBuildState,
  op: IRExtrude,
  shape: OC,
  assembly: PreparedComponentAssembly,
): void {
  const axis = state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(oc);
  assembly.addExtrudedBody(op, shape, axis);
  registerPrimitiveNamedEdgesForBody(oc, state, op.objName, op.sketchName);
}

/**
 * Handles restore sketch axis body in the bridge flow.
 */
function restoreSketchAxisBody(
  oc: OC,
  state: GroupBuildState,
  op: Extract<IROp, { kind: 'radial_extrude' | 'sweep' }>,
  shape: OC,
  assembly: PreparedComponentAssembly,
  registerEdges: boolean,
): void {
  assembly.addBodyFromSketchAxis(
    op.objName,
    op.sketchName,
    shape,
    op.material ?? null,
    op.span,
  );
  if (registerEdges)
    registerPrimitiveNamedEdgesForBody(oc, state, op.objName, op.sketchName);
}

/**
 * Handles restore loft in the bridge flow.
 */
function restoreLoft(
  oc: OC,
  state: GroupBuildState,
  op: Extract<IROp, { kind: 'loft' }>,
  shape: OC,
  assembly: PreparedComponentAssembly,
): void {
  (shape as { _sourceOperationKind?: string })._sourceOperationKind = 'loft';
  const axis = state.sketchAxes.get(op.sketchNames[0]) ?? makeDefaultAxis(oc);
  assembly.addBody(
    op.objName,
    shape,
    faceFrameFromAx2(axis),
    op.material ?? null,
    op.span,
  );
  for (const sketchName of op.sketchNames)
    registerPrimitiveNamedEdgesForBody(oc, state, op.objName, sketchName);
}

/**
 * Handles restore revolve in the bridge flow.
 */
function restoreRevolve(
  oc: OC,
  state: GroupBuildState,
  op: IRRevolve,
  shape: OC,
  assembly: PreparedComponentAssembly,
): void {
  const axis = state.sketchAxes.get(op.sketchName) ?? makeDefaultAxis(oc);
  assembly.addBody(
    op.objName,
    shape,
    assembly.revolveBodyFrame(op, axis),
    op.material ?? null,
    op.span,
  );
  registerPrimitiveNamedEdgesForBody(oc, state, op.objName, op.sketchName, {
    revolveAxis: assembly.revolveAxisVectors(op, axis),
  });
}
