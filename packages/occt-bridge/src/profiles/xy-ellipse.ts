/**
 * @author Aidan Boissonneault
 * @file xy-ellipse.ts
 * @purpose Provides xy ellipse behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IREllipseSegment } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';

/**
 * Xy ellipse handles, including origin, z dir, x dir, ax2, and ellipse.
 */
type XYEllipseHandles = {
  origin: OC;
  zDir: OC;
  xDir: OC;
  ax2: OC;
  ellipse: OC;
  verticalMajor: boolean;
};

/** Creates an exact OpenCascade ellipse using its required major-first axis. */
export function makeXYEllipseHandles(
  oc: OC,
  center: readonly [number, number],
  radiusX: number,
  radiusY: number,
): XYEllipseHandles {
  const verticalMajor = radiusY > radiusX;
  const origin = new oc.gp_Pnt_3(center[0], center[1], 0);
  const zDir = new oc.gp_Dir_4(0, 0, 1);
  const xDir = new oc.gp_Dir_4(verticalMajor ? 0 : 1, verticalMajor ? 1 : 0, 0);
  const ax2 = new oc.gp_Ax2_2(origin, zDir, xDir);
  const ellipse = new oc.gp_Elips_2(
    ax2,
    Math.max(radiusX, radiusY),
    Math.min(radiusX, radiusY),
  );
  return { origin, zDir, xDir, ax2, ellipse, verticalMajor };
}

/** Builds a one-edge exact ellipse wire for compact sketch primitives. */
export function buildXYEllipseWire(
  oc: OC,
  width: number,
  height: number,
  center: readonly [number, number] = [0, 0],
): OC {
  const handles = makeXYEllipseHandles(oc, center, width / 2, height / 2);
  const edge = new oc.BRepBuilderAPI_MakeEdge_12(handles.ellipse).Edge();
  const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
  releaseEllipseHandles(handles, edge);
  return wire;
}

/** Builds one exact full or trimmed profile ellipse edge. */
export function buildXYEllipseEdge(oc: OC, segment: IREllipseSegment): OC {
  const handles = makeXYEllipseHandles(
    oc,
    segment.center,
    segment.radiusX,
    segment.radiusY,
  );
  const edge = segment.full
    ? new oc.BRepBuilderAPI_MakeEdge_12(handles.ellipse).Edge()
    : new oc.BRepBuilderAPI_MakeEdge_13(
        handles.ellipse,
        occtParameter(segment.startAngle, handles.verticalMajor),
        occtParameter(segment.endAngle, handles.verticalMajor),
      ).Edge();
  releaseEllipseHandles(handles);
  return edge;
}

/**
 * Handles OpenCascade parameter in the profiles flow.
 */
function occtParameter(sourceAngle: number, verticalMajor: boolean): number {
  return verticalMajor ? sourceAngle - Math.PI / 2 : sourceAngle;
}

/**
 * Handles release ellipse handles in the profiles flow.
 */
function releaseEllipseHandles(handles: XYEllipseHandles, edge?: OC): void {
  [
    handles.origin,
    handles.zDir,
    handles.xDir,
    handles.ax2,
    handles.ellipse,
    edge,
  ].forEach((item) => item?.delete());
}
