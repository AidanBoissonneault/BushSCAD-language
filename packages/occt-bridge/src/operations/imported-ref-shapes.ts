/**
 * @author Aidan Boissonneault
 * @file imported-ref-shapes.ts
 * @purpose Provides imported ref shapes behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRAlignShape, IRImportShape, IRRef } from '@bushscad/ir';
import type { FaceFrame } from '../topology/face-labels.js';
import { makeDefaultAxis } from '../core/geometry-utils.js';
import { copyNamedFaceEdgesThroughTransform } from '../topology/named-face-edge-labels.js';
import { occtError } from '../core/occt-errors.js';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';

const DEFAULT_FRAME: FaceFrame = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/**
 * Registers an imported shape as declaration-only source geometry.
 * Imported shapes are reusable sources. They should provide labels for later
 * placement, but should not render until an explicit placement creates an
 * instance.
 */
export function buildImportShapeOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRImportShape,
): void {
  const shape =
    op.format === 'stl' ? readStlShape(oc, op) : readStepShape(oc, op);
  registerSourceShape(oc, state, op.name, shape, DEFAULT_FRAME);
}

/**
 * Reads STEP/STP imported geometry into an OCCT shape.
 * STEP import preserves analytic CAD topology when available, so it remains the
 * default reader for existing `import shape` files.
 */
function readStepShape(oc: OC, op: IRImportShape): OC {
  const reader = new oc.STEPControl_Reader_1();
  const status = reader.ReadFile(op.fsPath);
  if (status !== oc.IFSelect_ReturnStatus.IFSelect_RetDone) {
    throw occtError(`STEP import failed for '${op.fsPath}'`, op.span);
  }
  reader.TransferRoots(new oc.Message_ProgressRange_1());
  const shape = reader.OneShape();
  if (!shape || shape.IsNull()) {
    throw occtError(
      `STEP import produced no shape from '${op.fsPath}'`,
      op.span,
    );
  }
  return shape;
}

/**
 * Reads STL imported geometry into an OCCT triangulated shape.
 * STL imports are mesh-only sources. They can still be placed and exported, but
 * callers use a ref wrapper when they want to add healing, defeaturing, or
 * source anchors.
 */
function readStlShape(oc: OC, op: IRImportShape): OC {
  const shape = new oc.TopoDS_Shape();
  const reader =
    typeof oc.StlAPI_Reader_1 === 'function'
      ? new oc.StlAPI_Reader_1()
      : new oc.StlAPI_Reader();
  const ok = reader.Read(shape, op.fsPath);
  if (!ok) {
    throw occtError(`STL import failed for '${op.fsPath}'`, op.span);
  }
  if (!shape || shape.IsNull()) {
    throw occtError(
      `STL import produced no shape from '${op.fsPath}'`,
      op.span,
    );
  }
  return shape;
}

/**
 * Creates a declaration-only ref copy from another shape source.
 * Ref declarations can add healing, defeaturing, and anchors without mutating
 * the original imported source.
 */
export function buildRefOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRRef,
): void {
  const base = state.bodyShapes.get(op.baseName);
  if (!base) {
    throw occtError(`ref: no shape named '${op.baseName}'`, op.span);
  }
  const copy = new oc.BRepBuilderAPI_Copy_2(base, true, false).Shape();
  const frame = state.bodyFrames.get(op.baseName) ?? DEFAULT_FRAME;
  registerSourceShape(oc, state, op.name, copy, frame);
}

/**
 * Places a copy of source geometry under a unique instance name.
 * Repeated placement of the same imported/ref shape must render multiple
 * instances. The source declaration stays stable for anchors and future copies.
 */
export function buildAlignShapeOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRAlignShape,
): void {
  const shape =
    state.bodyShapes.get(op.name) ??
    (state.globalLabels.getShape(op.name) as OC | undefined);
  if (!shape) {
    throw occtError(`alignShape: no shape named '${op.name}'`, op.span);
  }

  const targetAx2 = state.labelMap.resolveAxis(oc, op.targetPlacement) as OC;
  const sourceAx2: OC = op.sourceRef
    ? (state.labelMap.resolveAxis(oc, { faceRef: op.sourceRef }) as OC)
    : (makeDefaultAxis(oc) as OC);

  const aligned = alignShapeCopy(oc, shape, sourceAx2, targetAx2, op);
  const moved = aligned.shape;
  const frame = state.bodyFrames.get(op.name) ?? DEFAULT_FRAME;
  state.bodyShapes.set(op.instanceName, moved);
  state.bodyOwners.set(op.instanceName, op.instanceName);
  state.bodyEdgeModes.set(op.instanceName, 'outer');
  state.bodyFrames.set(op.instanceName, frame);
  state.bodyMaterials.set(op.instanceName, null);
  state.labelMap.register(oc, op.instanceName, moved, 'outer', frame);
  copyNamedFaceEdgesThroughTransform(
    oc,
    state.labelMap,
    op.name,
    op.instanceName,
    moved,
    aligned.transform,
  );
  aligned.transform.delete?.();
}

/**
 * Re-registers a mutated source shape into local and shared label maps.
 * Healing and defeaturing change source topology before placement, so later
 * parts must resolve labels against the updated source.
 */
export function reregisterSourceShape(
  oc: OC,
  state: GroupBuildState,
  name: string,
  shape: OC,
): void {
  const frame = state.bodyFrames.get(name) ?? DEFAULT_FRAME;
  state.labelMap.register(oc, name, shape, 'outer', frame);
  state.globalLabels.register(oc, name, shape, 'outer', frame);
}

/**
 * Handles register source shape in the operations flow.
 */
function registerSourceShape(
  oc: OC,
  state: GroupBuildState,
  name: string,
  shape: OC,
  frame: FaceFrame,
): void {
  state.bodyShapes.set(name, shape);
  state.bodyOwners.set(name, name);
  state.declaredShapeNames.add(name);
  state.bodyFrames.set(name, frame);
  state.labelMap.register(oc, name, shape, 'outer', frame);
  state.globalLabels.register(oc, name, shape, 'outer', frame);
}

/**
 * Handles align shape copy in the operations flow.
 */
function alignShapeCopy(
  oc: OC,
  shape: OC,
  sourceAx2: OC,
  targetAx2: OC,
  op: IRAlignShape,
): { shape: OC; transform: OC } {
  const tLoc = targetAx2.Location();
  const tDir = targetAx2.Direction();
  const tXDir = targetAx2.XDirection();
  const flippedDir = new oc.gp_Dir_4(-tDir.X(), -tDir.Y(), -tDir.Z());
  const matedTarget = new oc.gp_Ax2_2(tLoc, flippedDir, tXDir);
  const trsf = new oc.gp_Trsf_1();
  const targetAx3 = new oc.gp_Ax3_2(matedTarget);
  const sourceAx3 = new oc.gp_Ax3_2(sourceAx2);
  trsf.SetDisplacement(sourceAx3, targetAx3);
  targetAx3.delete();
  sourceAx3.delete();
  flippedDir.delete();
  matedTarget.delete();

  const builder = new oc.BRepBuilderAPI_Transform_2(shape, trsf, true);
  if (typeof builder.IsDone === 'function' && !builder.IsDone()) {
    throw occtError(`alignShape: transform failed for '${op.name}'`, op.span);
  }
  const moved = builder.Shape();
  builder.delete?.();
  return { shape: moved, transform: trsf };
}
