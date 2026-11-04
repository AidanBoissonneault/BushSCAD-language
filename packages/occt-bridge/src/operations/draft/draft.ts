/** Implements the draft behavior owned by the OCCT bridge. */

import { ModifiersBridge } from '../modifiers/modifiers.js';

import type { IRDraft, SourceSpan } from '@bushscad/ir';

import { FaceLabelMap } from '../../topology/face-labels.js';

import { parseFaceRef } from '../../core/program-utils.js';

import { readBounds } from '../../core/geometry-utils.js';

import {
  isOcctError,
  occtError,
  rawErrorMessage,
} from '../../core/occt-errors.js';

import { getDraftFaceHandles } from '../draft-face-handles.js';

import type { OC } from '../../bridge/bridge-types.js';

export abstract class DraftBridge extends ModifiersBridge {
  protected override applyDraftPhase(
    owner: string,
    ops: IRDraft[],
    labelMap: FaceLabelMap,
    replaceBody: (name: string, shape: OC) => void,
  ): void {
    const oc = this.oc;
    for (const op of ops) {
      let neutralPlane: OC | null = null;
      try {
        const parsed = parseFaceRef(op.target);
        const shape = labelMap.getShape(parsed.objName);
        if (!shape)
          throw occtError(
            `Unknown object '${parsed.objName}' for draft`,
            op.span,
          );
        const faceHandles = getDraftFaceHandles(labelMap, op.target);
        if (faceHandles.length === 0)
          throw occtError(`No face for draft '${op.target}'`, op.span);
        neutralPlane = this.buildNeutralPlane(oc, shape);
        const result = this.applyDraft(
          shape,
          faceHandles,
          op.angleDeg,
          neutralPlane,
          op.span,
        );
        replaceBody(parsed.objName, result);
      } catch (err) {
        const parsed = parseFaceRef(op.target);
        if (labelMap.hasSourceMemory(parsed.objName)) return;
        if (isOcctError(err)) throw err;
        throw occtError(
          `Draft phase failed for body '${owner}' target '${op.target}': ${rawErrorMessage(err)}`,
          op.span,
        );
      } finally {
        neutralPlane?.delete?.();
      }
    }
  }

  protected override buildNeutralPlane(oc: OC, shape: OC): OC {
    // Use the bottom face's plane as the neutral plane for draft
    const { xMin, xMax, yMin, yMax, zMin } = readBounds(oc, shape);
    const midX = (xMin.current + xMax.current) / 2;
    const midY = (yMin.current + yMax.current) / 2;
    const origin = new oc.gp_Pnt_3(midX, midY, zMin.current);
    const normal = new oc.gp_Dir_4(0, 0, 1);
    const plane = new oc.gp_Pln_3(origin, normal);
    origin.delete();
    normal.delete();
    return plane;
  }

  protected override applyDraft(
    shape: OC,
    faces: unknown[],
    angleDeg: number,
    neutralPlane: OC,
    span: SourceSpan,
  ): OC {
    const oc = this.oc;
    const drafter = new oc.BRepOffsetAPI_DraftAngle_2(shape);
    const pullDir = new oc.gp_Dir_4(0, 0, 1);
    const angleRad = (angleDeg * Math.PI) / 180;
    for (const face of faces)
      drafter.Add(face, pullDir, angleRad, neutralPlane, false);
    drafter.Build();
    if (!drafter.IsDone()) throw occtError('Draft failed', span);
    const result = drafter.Shape();
    pullDir.delete();
    drafter.delete();
    return result;
  }
}
