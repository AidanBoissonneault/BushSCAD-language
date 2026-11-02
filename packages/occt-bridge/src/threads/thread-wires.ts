/**
 * @author Aidan Boissonneault
 * @file thread-wires.ts
 * @purpose Provides thread wires behavior for the threads in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { occtError } from '../core/occt-errors.js';

/**
 * Builds a closed OCCT wire from 3D points.
 * Both revolved and angled thread tools need small planar profiles. Keeping the
 * OCCT handle lifecycle in one place avoids duplicated cleanup paths.
 */
export function makeClosedWireFromPoints(
  oc: OC,
  points: Array<[number, number, number]>,
  span: SourceSpan,
  errorMessage: string,
): OC {
  const ptHandles = points.map(([x, y, z]) => new oc.gp_Pnt_3(x, y, z));
  const wb = new oc.BRepBuilderAPI_MakeWire_1();
  const edgeHandles: OC[] = [];
  for (let i = 0; i < ptHandles.length; i++) {
    const edge = new oc.BRepBuilderAPI_MakeEdge_3(
      ptHandles[i],
      ptHandles[(i + 1) % ptHandles.length],
    ).Edge();
    wb.Add_1(edge);
    edgeHandles.push(edge);
  }
  const wireOk = wb.IsDone();
  const wire = wireOk ? wb.Wire() : null;
  [...ptHandles, ...edgeHandles, wb].forEach((shape) => shape.delete?.());
  if (!wireOk || !wire) throw occtError(errorMessage, span);
  return wire;
}

/**
 * Builds a face from a closed wire and releases the input wire.
 * Thread cutter construction creates many short-lived profile wires. This
 * helper keeps ownership transfer explicit and consistent.
 */
export function makeFaceFromWire(
  oc: OC,
  wire: OC,
  span: SourceSpan,
  errorMessage: string,
): OC {
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
  const faceOk = faceMaker.IsDone();
  const face = faceOk ? faceMaker.Face() : null;
  wire.delete();
  faceMaker.delete();
  if (!faceOk || !face) throw occtError(errorMessage, span);
  return face;
}
