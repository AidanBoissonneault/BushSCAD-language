/**
 * @author Aidan Boissonneault
 * @file profile-faces.ts
 * @purpose Provides profile faces behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, IRProfileSegment, SourceSpan } from '@bushscad/ir';
import {
  analyzeCircularArcLoop,
  detectProfileLoops,
  selectedProfileSegments,
} from '@bushscad/ir';
import { applyStableBoolFuse } from '../operations/boolean-operations.js';
import type { OC } from '../bridge/bridge-types.js';
import { radiusArcCenter } from '../topology/frame-utils.js';
import { occtError } from '../core/occt-errors.js';
import { makeXYCircleHandles } from './xy-circle.js';
import { buildXYEllipseEdge } from './xy-ellipse.js';

/**
 * Returns profile segment groups for full-sketch or named-body selection.
 * Multi-body path sketches must become separate OCCT faces, while older single
 * closed profiles should continue to behave as one wire.
 */
export function profileFaceSegmentGroups(
  prim: Extract<IRPrimitive, { kind: 'profile' }>,
  selectedNames?: string[],
): IRProfileSegment[][] {
  const selected = selectedProfileSegments(
    prim.segments,
    prim.closedBodies,
    selectedNames,
  );
  const loops = detectProfileLoops(selected);
  return loops.length > 0 ? loops.map((loop) => loop.segments) : [selected];
}

/** Builds a profile wire from line and radius-arc segments. */
export function buildProfileWireFromSegments(
  oc: OC,
  segments: IRProfileSegment[],
): OC {
  const drawableSegments = segments.filter((item) => !item.construction);
  const circle = fullCircleFromArcSegments(drawableSegments);
  if (circle) return buildCircleWire(oc, circle.center, circle.radius);

  const wb = new oc.BRepBuilderAPI_MakeWire_1();
  const edges: OC[] = [];
  for (const segment of drawableSegments) {
    const edge = buildProfileEdge(oc, segment);
    wb.Add_1(edge);
    edges.push(edge);
  }
  const wire = wb.Wire();
  edges.forEach((edge) => edge.delete());
  wb.delete();
  return wire;
}

/**
 * Builds profile edge from the supplied inputs.
 */
function buildProfileEdge(oc: OC, segment: IRProfileSegment): OC {
  if (segment.kind === 'line') {
    return buildLineEdge(oc, segment.from, segment.to);
  }
  if (segment.kind === 'ellipse') return buildXYEllipseEdge(oc, segment);
  return buildRadiusArcEdge(
    oc,
    segment.from,
    segment.to,
    segment.radius,
    segment.clockwise,
  );
}

/**
 * Detects when profile arcs describe one complete circle.
 * This lets path-generated sketch circles keep editable arc metadata while
 * avoiding four separate CAD edges in generated model topology.
 */
function fullCircleFromArcSegments(
  segments: IRProfileSegment[],
): { center: [number, number]; radius: number } | null {
  if (!segments.every((segment) => segment.kind === 'arc')) return null;
  const result = analyzeCircularArcLoop(segments);
  return result.recognized
    ? { center: result.center, radius: result.radius }
    : null;
}

/**
 * Builds a single-edge circular wire from coalesced profile arcs.
 * Editor circles are stored as quadrant arcs for sketch editing, but downstream
 * CAD selectors should see the perimeter as one circular edge.
 */
function buildCircleWire(oc: OC, center: [number, number], radius: number): OC {
  const { origin, zDir, xDir, ax2, circ } = makeXYCircleHandles(
    oc,
    center[0],
    center[1],
    radius,
  );
  const edge = new oc.BRepBuilderAPI_MakeEdge_8(circ).Edge();
  const wire = new oc.BRepBuilderAPI_MakeWire_2(edge).Wire();
  [origin, zDir, xDir, ax2, circ, edge].forEach((item: OC) => item.delete());
  return wire;
}

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arcAngles(
  center: [number, number],
  from: [number, number],
  to: [number, number],
  clockwise: boolean,
): [number, number] {
  const a0 = Math.atan2(from[1] - center[1], from[0] - center[0]);
  return [
    a0,
    adjustedArcEndAngle(
      a0,
      Math.atan2(to[1] - center[1], to[0] - center[0]),
      clockwise,
    ),
  ];
}

/**
 * Handles adjusted arc end angle in the profiles flow.
 */
function adjustedArcEndAngle(
  start: number,
  end: number,
  clockwise: boolean,
): number {
  if (clockwise) return end > start ? end - Math.PI * 2 : end;
  return end < start ? end + Math.PI * 2 : end;
}

/** Builds one face or a compound of faces for selected profile bodies. */
export function buildProfileFaceShape(
  oc: OC,
  groups: IRProfileSegment[][],
  span: SourceSpan,
): OC {
  const faces = groups.map((segments) =>
    buildFaceFromProfileWire(oc, segments, span),
  );
  if (faces.length === 1) return faces[0];
  const compound = new oc.TopoDS_Compound();
  const builder = new oc.BRep_Builder();
  builder.MakeCompound(compound);
  faces.forEach((face) => builder.Add(compound, face));
  faces.forEach((face) => face.delete());
  builder.delete();
  return compound;
}

/**
 * Builds the face shape for a full profile or selected atomic closed bodies.
 * Overlapping closed loops produce selectable regions that are not identical to
 * any single loop. Those regions must be composed from loop faces with boolean
 * common/cut operations before extrusion.
 */
export function buildProfileFaceForPrimitive(
  oc: OC,
  prim: Extract<IRPrimitive, { kind: 'profile' }>,
  span: SourceSpan,
  selectedNames?: string[],
): OC {
  const loops = detectProfileLoops(prim.segments);
  if (usesFullSketchLoops(prim, selectedNames))
    return buildFullSketchLoopFace(oc, prim, loops, span);
  return buildProfileFaceShape(
    oc,
    profileFaceSegmentGroups(prim, selectedNames),
    span,
  );
}

/**
 * Handles uses full sketch loops in the profiles flow.
 */
function usesFullSketchLoops(
  prim: Extract<IRPrimitive, { kind: 'profile' }>,
  selectedNames?: string[],
): boolean {
  return (
    !selectedNames?.length && !prim.closedBodies?.some((body) => body.ignored)
  );
}

/**
 * Builds full sketch loop face from the supplied inputs.
 */
function buildFullSketchLoopFace(
  oc: OC,
  prim: Extract<IRPrimitive, { kind: 'profile' }>,
  loops: ReturnType<typeof detectProfileLoops>,
  span: SourceSpan,
): OC {
  const faces = loops.map((loop) =>
    buildFaceFromProfileWire(oc, loop.segments, span),
  );
  return faces.length > 0
    ? fuseShapes(oc, faces, span)
    : buildProfileFaceShape(oc, [prim.segments], span);
}

/**
 * Handles fuse shapes in the profiles flow.
 */
function fuseShapes(oc: OC, shapes: OC[], span: SourceSpan): OC {
  let shape = firstShape(shapes, span);
  for (const nextShape of shapes.slice(1)) {
    const next = applyStableBoolFuse(
      oc,
      shape,
      nextShape,
      span,
      'Closed body union failed',
    );
    shape.delete?.();
    nextShape.delete?.();
    shape = next;
  }
  return shape;
}

/**
 * Returns the first shape that matches the requested condition.
 */
function firstShape(shapes: OC[], span: SourceSpan): OC {
  if (shapes.length === 0)
    throw occtError('No closed bodies selected for profile', span);
  return shapes[0];
}

/**
 * Builds face from profile wire from the supplied inputs.
 */
function buildFaceFromProfileWire(
  oc: OC,
  segments: IRProfileSegment[],
  span: SourceSpan,
): OC {
  const wire = buildProfileWireFromSegments(oc, segments);
  const faceMaker = new oc.BRepBuilderAPI_MakeFace_15(wire, false);
  if (!faceMaker.IsDone()) {
    throw occtError('Face build failed for profile', span);
  }
  const face = faceMaker.Face();
  faceMaker.delete();
  wire.delete();
  return face;
}

/**
 * Builds line edge from the supplied inputs.
 */
function buildLineEdge(
  oc: OC,
  from: [number, number],
  to: [number, number],
): OC {
  const p0 = new oc.gp_Pnt_3(from[0], from[1], 0);
  const p1 = new oc.gp_Pnt_3(to[0], to[1], 0);
  const edge = new oc.BRepBuilderAPI_MakeEdge_3(p0, p1).Edge();
  p0.delete();
  p1.delete();
  return edge;
}

/**
 * Builds radius arc edge from the supplied inputs.
 */
function buildRadiusArcEdge(
  oc: OC,
  from: [number, number],
  to: [number, number],
  radius: number,
  clockwise: boolean,
): OC {
  const center = radiusArcCenter(from, to, radius, clockwise);
  const { origin, zDir, xDir, ax2, circ } = makeXYCircleHandles(
    oc,
    center[0],
    center[1],
    radius,
  );
  const [a0, a1] = arcAngles(center, from, to, clockwise);
  const edge = new oc.BRepBuilderAPI_MakeEdge_9(circ, a0, a1).Edge();
  [origin, zDir, xDir, ax2, circ].forEach((item: OC) => item.delete());
  return edge;
}
