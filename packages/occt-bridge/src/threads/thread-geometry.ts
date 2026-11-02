/**
 * @author Aidan Boissonneault
 * @file thread-geometry.ts
 * @purpose Provides thread geometry behavior for the threads in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRThread, SourceSpan } from '@bushscad/ir';
import type { FaceFrame } from '../topology/face-labels.js';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import { readBounds } from '../core/geometry-utils.js';
import { occtError } from '../core/occt-errors.js';
import { applyThreadBoolCut, applyThreadBoolFuse } from './thread-booleans.js';
import {
  buildHelicalThreadCutTool,
  makeInternalThreadRidgeProfile,
  makeHelicalThreadCutProfile,
} from './thread-helix.js';
import { resolveThreadAxis, type ThreadAxis } from './thread-axis.js';
import { makeClosedWireFromPoints, makeFaceFromWire } from './thread-wires.js';

/**
 * Applies modeled thread geometry to the target body.
 * Threading needs both evaluator-provided hole placement and OCCT body bounds.
 * Keeping that logic here prevents the main bridge dispatcher from owning
 * thread profile construction, axis inference, and boolean cutting.
 */
export function buildThreadOperation(
  oc: OC,
  state: GroupBuildState,
  op: IRThread,
  ownerFor: (name: string) => string,
  replaceBody: (name: string, shape: OC) => void,
): void {
  const irName = ownerFor(op.target);
  const bodyShape = state.bodyShapes.get(irName);
  if (!bodyShape) return;

  const frame =
    state.bodyFrames.get(irName) ??
    ({ x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] } as FaceFrame);
  const bounds = readBounds(oc, bodyShape);
  const threadAxis = resolveThreadAxis(oc, state, op, bodyShape, bounds, frame);
  const pitch = op.pitchMm;
  const threadDepth = 0.6 * pitch;
  const majorR = op.diameterMm / 2;
  const minorR = Math.max(majorR - threadDepth, majorR * 0.25);
  const valleyR = op.threadType === 'external' ? minorR : majorR;
  const crustR = op.threadType === 'external' ? majorR + 0.1 : minorR;
  const extent = Math.max(pitch, threadAxis.extent);
  const numGrooves = Math.max(1, Math.floor(extent / pitch));
  const originalBounds = readBounds(oc, bodyShape);
  let currentShape = bodyShape;
  const addInternalRidge =
    op.threadType === 'internal' && op.direction !== 'regular';
  if (op.threadType === 'internal') {
    const boreTool = buildInternalBoreTool(
      oc,
      op.span,
      threadAxis,
      addInternalRidge ? majorR : minorR,
      extent,
    );
    currentShape = applyThreadBoolCut(
      oc,
      bodyShape,
      boreTool,
      op.span,
      originalBounds,
      op.threadType,
      threadDepth,
    );
    boreTool.delete?.();
  }
  const tool = addInternalRidge
    ? buildInternalThreadRidgeTool(
        oc,
        op.span,
        threadAxis,
        minorR,
        majorR,
        pitch,
        extent,
        op.direction as Exclude<IRThread['direction'], 'regular'>,
        op.threadAngleDeg,
        threadDepth,
      )
    : buildThreadCutTool(
        oc,
        op.span,
        threadAxis,
        crustR,
        valleyR,
        pitch,
        extent,
        numGrooves,
        op.threadType,
        op.direction,
        op.threadAngleDeg,
        threadDepth,
      );
  const applyBoolean = addInternalRidge
    ? applyThreadBoolFuse
    : applyThreadBoolCut;
  const result = applyBoolean(
    oc,
    currentShape,
    tool,
    op.span,
    originalBounds,
    op.threadType,
    threadDepth,
  );
  tool.delete?.();
  replaceBody(irName, result);
}

/**
 * Builds thread cut tool from the supplied inputs.
 */
function buildThreadCutTool(
  oc: OC,
  span: SourceSpan,
  axis: ThreadAxis,
  crustR: number,
  valleyR: number,
  pitch: number,
  extent: number,
  numGrooves: number,
  threadType: IRThread['threadType'],
  direction: IRThread['direction'],
  angleDeg: number | null,
  threadDepth: number,
): OC {
  if (direction !== 'regular') {
    const profile = makeHelicalThreadCutProfile(
      threadType,
      crustR,
      valleyR,
      pitch,
      threadDepth,
    );
    const helixRadius = (profile.innerRadius + profile.outerRadius) / 2;
    return buildHelicalThreadCutTool(
      oc,
      span,
      { axis, radius: helixRadius, pitch, extent, direction, angleDeg },
      profile,
    );
  }

  const profilePts = makeThreadProfilePoints(
    crustR,
    valleyR,
    pitch,
    numGrooves,
    direction,
  );
  const wire = makeThreadProfileWire(oc, profilePts, axis, span);
  const face = makeThreadProfileFace(oc, wire, span);
  return revolveThreadProfile(oc, face, axis, span);
}

/**
 * Builds internal thread ridge tool from the supplied inputs.
 */
function buildInternalThreadRidgeTool(
  oc: OC,
  span: SourceSpan,
  axis: ThreadAxis,
  minorR: number,
  majorR: number,
  pitch: number,
  extent: number,
  direction: Exclude<IRThread['direction'], 'regular'>,
  angleDeg: number | null,
  threadDepth: number,
): OC {
  const profile = makeInternalThreadRidgeProfile(
    minorR,
    majorR,
    pitch,
    threadDepth,
  );
  const helixRadius = (profile.innerRadius + profile.outerRadius) / 2;
  return buildHelicalThreadCutTool(
    oc,
    span,
    { axis, radius: helixRadius, pitch, extent, direction, angleDeg },
    profile,
  );
}

/**
 * Builds internal bore tool from the supplied inputs.
 */
function buildInternalBoreTool(
  oc: OC,
  span: SourceSpan,
  axis: ThreadAxis,
  radius: number,
  extent: number,
): OC {
  const profilePts: Array<[number, number]> = [
    [0, 0],
    [radius, 0],
    [radius, -extent],
    [0, -extent],
  ];
  const wire = makeThreadProfileWire(oc, profilePts, axis, span);
  const face = makeThreadProfileFace(oc, wire, span);
  return revolveThreadProfile(oc, face, axis, span);
}

/**
 * Constructs thread profile points from the supplied values.
 */
function makeThreadProfilePoints(
  crustR: number,
  valleyR: number,
  pitch: number,
  numGrooves: number,
  direction: IRThread['direction'],
): Array<[number, number]> {
  const leadOffset = direction === 'regular' ? 0 : pitch * 0.2;
  const handedSign = direction === 'clockwise' ? 1 : -1;
  const profilePts: Array<[number, number]> = [[crustR, 0]];
  for (let i = 0; i < numGrooves; i++) {
    const phaseOffset = i % 2 === 0 ? leadOffset * handedSign : 0;
    profilePts.push([valleyR, -(i + 0.5) * pitch + phaseOffset]);
    profilePts.push([crustR, -(i + 1) * pitch]);
  }
  return profilePts;
}

/**
 * Constructs thread profile wire from the supplied values.
 */
function makeThreadProfileWire(
  oc: OC,
  profilePts: Array<[number, number]>,
  axis: ThreadAxis,
  span: SourceSpan,
): OC {
  const [topX, topY, topZ] = axis.top;
  const az = axis.axis;
  const ax = axis.x;
  const points: Array<[number, number, number]> = profilePts.map(
    ([r, zOff]) => [
      topX + r * ax[0] + zOff * az[0],
      topY + r * ax[1] + zOff * az[1],
      topZ + r * ax[2] + zOff * az[2],
    ],
  );
  return makeClosedWireFromPoints(
    oc,
    points,
    span,
    'Thread profile wire failed',
  );
}

/**
 * Constructs thread profile face from the supplied values.
 */
function makeThreadProfileFace(oc: OC, wire: OC, span: SourceSpan): OC {
  return makeFaceFromWire(oc, wire, span, 'Thread profile face failed');
}

/**
 * Handles revolve thread profile in the threads flow.
 */
function revolveThreadProfile(
  oc: OC,
  face: OC,
  axis: ThreadAxis,
  span: SourceSpan,
): OC {
  const [cx, cy, cz] = axis.center;
  const az = axis.axis;
  const origin = new oc.gp_Pnt_3(cx, cy, cz);
  const direction = new oc.gp_Dir_4(az[0], az[1], az[2]);
  const revolveAxis = new oc.gp_Ax1_2(origin, direction);
  origin.delete();
  direction.delete();
  const revolver = new oc.BRepPrimAPI_MakeRevol_1(
    face,
    revolveAxis,
    2 * Math.PI,
    false,
  );
  face.delete();
  revolveAxis.delete?.();
  if (!revolver.IsDone()) {
    revolver.delete();
    throw occtError('Thread groove revolve failed', span);
  }
  const tool = revolver.Shape();
  revolver.delete();
  return tool;
}
