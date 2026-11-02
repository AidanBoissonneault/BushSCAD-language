/**
 * @author Aidan Boissonneault
 * @file shell-operations.ts
 * @purpose Provides shell operations behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRShell, SourceSpan } from '@bushscad/ir';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import { occtError } from '../core/occt-errors.js';

/**
 * Builds and registers a shell operation against the current labeled shape.
 * Shelling needs current face handles after cuts, lofts, and fuses. Keeping
 * lookup and OCCT setup together prevents open-face behavior from drifting.
 */
export function buildShellOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRShell,
  replaceBody: (name: string, shape: OC) => void,
): void {
  const shape = state.labelMap.getShape(op.objName);
  if (!shape)
    throw occtError(`Unknown object '${op.objName}' for shell`, op.span);
  const openFaceHandles = op.openFaces.flatMap((f) =>
    state.labelMap.getFaceHandles(
      op.objName,
      f as import('../core/program-utils.js').FaceDir,
    ),
  );
  const result = applyShell(oc, shape, openFaceHandles, op.thickness, op.span);
  replaceBody(op.objName, result);
}

/**
 * Applies OCCT thick-solid shelling with source-mapped failures.
 * OpenCascade may throw low-level exceptions for invalid open-face sets. The
 * compiler should report the shell statement instead of a raw numeric code.
 */
function applyShell(
  oc: OC,
  shape: OC,
  openFaces: unknown[],
  thickness: number,
  span: SourceSpan,
): OC {
  const faceList = new oc.TopTools_ListOfShape_1();
  let sheller: OC | null = null;
  try {
    for (const face of openFaces) faceList.Append_1(face);
    sheller = new oc.BRepOffsetAPI_MakeThickSolid_1();
    sheller.MakeThickSolidByJoin(
      shape,
      faceList,
      -thickness,
      1e-3,
      oc.BRepOffset_Mode.BRepOffset_Skin,
      false,
      false,
      oc.GeomAbs_JoinType.GeomAbs_Arc,
      false,
    );
    sheller.Build();
    if (!sheller.IsDone()) throw occtError('Shell failed', span);
    return sheller.Shape();
  } catch (err) {
    if ((err as { __occt?: boolean }).__occt) throw err;
    throw occtError(
      `Shell failed: ${err instanceof Error ? err.message : String(err)}`,
      span,
    );
  } finally {
    faceList.delete?.();
    sheller?.delete?.();
  }
}
