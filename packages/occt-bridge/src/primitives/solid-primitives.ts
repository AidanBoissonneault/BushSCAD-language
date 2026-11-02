/**
 * @author Aidan Boissonneault
 * @file solid-primitives.ts
 * @purpose Provides solid primitives behavior for the primitives in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRSolidPrimitive, IRSolidPrimitiveShape } from '@bushscad/ir';
import { faceFrameFromAx2 } from '../topology/face-labels.js';
import type { FaceFrame } from '../topology/face-labels.js';
import { makeDefaultAxis } from '../core/geometry-utils.js';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import type { SourceAttachmentPlane } from '../topology/source-edge-recovery.js';
import {
  attachmentPlane,
  extrudeFace,
  polyhedronCompound,
  rectFace,
  revolveProfile,
  roundedRectFace,
  transformToAxis,
} from './solid-primitive-geometry.js';
import {
  ellipsoidProfile,
  ellipticCylinderMesh,
  radialProfile,
  sphereProfile,
  torusProfile,
} from './solid-primitive-profiles.js';

/**
 * Primitive for built solid, including shape, frame, and attachment plane.
 */
type BuiltSolidPrimitive = {
  shape: OC;
  frame: FaceFrame;
  attachmentPlane?: SourceAttachmentPlane;
};

/**
 * Defines the `LocalPrimitiveBuilder` callback contract used by the primitives layer.
 */
type LocalPrimitiveBuilder = (oc: OC, op: IRSolidPrimitive) => OC;
/**
 * Selected members of IRSolidPrimitiveShape used for box shape.
 */
type BoxShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cuboid' | 'roundedCuboid' }
>;
/**
 * Selected members of IRSolidPrimitiveShape used for cylinder shape.
 */
type CylinderShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cylinder' | 'roundedCylinder' }
>;
/**
 * Selected members of IRSolidPrimitiveShape used for sphere shape.
 */
type SphereShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'sphere' | 'geodesicSphere' }
>;
/**
 * Selected members of IRSolidPrimitiveShape used for tapered shape.
 */
type TaperedShape = Extract<
  IRSolidPrimitiveShape,
  { primitive: 'cone' | 'frustum' }
>;

const LOCAL_PRIMITIVE_BUILDERS: Record<
  IRSolidPrimitiveShape['primitive'],
  LocalPrimitiveBuilder
> = {
  cuboid: buildCuboid,
  roundedCuboid: buildRoundedCuboid,
  cone: buildTaperedRevolve,
  frustum: buildTaperedRevolve,
  cylinder: buildCylinder,
  roundedCylinder: buildRoundedCylinder,
  sphere: buildSphere,
  torus: buildTorus,
  ellipsoid: buildEllipsoid,
  geodesicSphere: buildSphere,
  cylinderElliptic: buildEllipticCylinder,
  polyhedron: buildPolyhedron,
};

/**
 * Builds a direct 3D primitive in the placement frame selected by the IR op.
 * Direct primitives bypass sketch declarations but still need the same
 * topology, placement, and source-plane conventions as authored solids.
 */
export function buildSolidPrimitiveShape(
  oc: OC,
  state: GroupBuildState,
  op: IRSolidPrimitive,
): BuiltSolidPrimitive {
  const ax2 = op.placement
    ? state.labelMap.resolveAxis(oc, op.placement)
    : makeDefaultAxis(oc);
  try {
    const local = buildLocalPrimitive(oc, op);
    const shape = transformToAxis(oc, local, ax2);
    local.delete?.();
    return {
      shape,
      frame: faceFrameFromAx2(ax2),
      ...(primitiveGrowsFromPlane(op)
        ? { attachmentPlane: attachmentPlane(ax2) }
        : {}),
    };
  } finally {
    ax2.delete?.();
  }
}

/**
 * Builds local primitive from the supplied inputs.
 */
function buildLocalPrimitive(oc: OC, op: IRSolidPrimitive): OC {
  return LOCAL_PRIMITIVE_BUILDERS[op.shape.primitive](oc, op);
}

/**
 * Builds cuboid from the supplied inputs.
 */
function buildCuboid(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as BoxShape;
  return extrudeFace(
    oc,
    rectFace(oc, shape.size[0], shape.size[1], op.span),
    shape.size[2],
    op.span,
  );
}

/**
 * Builds rounded cuboid from the supplied inputs.
 */
function buildRoundedCuboid(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as BoxShape;
  return extrudeFace(
    oc,
    roundedRectFace(
      oc,
      shape.size[0],
      shape.size[1],
      shape.radius ?? 0,
      shape.segments,
      op.span,
    ),
    shape.size[2],
    op.span,
  );
}

/**
 * Builds tapered revolve from the supplied inputs.
 */
function buildTaperedRevolve(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as TaperedShape;
  return revolveProfile(
    oc,
    radialProfile(shape.radiusBottom, shape.radiusTop, shape.height),
    op.span,
  );
}

/**
 * Builds cylinder from the supplied inputs.
 */
function buildCylinder(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as CylinderShape;
  return revolveProfile(
    oc,
    radialProfile(
      shape.radiusBottom ?? shape.radius,
      shape.radiusTop ?? shape.radius,
      shape.height,
    ),
    op.span,
  );
}

/**
 * Builds rounded cylinder from the supplied inputs.
 */
function buildRoundedCylinder(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as CylinderShape;
  return revolveProfile(
    oc,
    radialProfile(shape.radius, shape.radius, shape.height),
    op.span,
  );
}

/**
 * Builds sphere from the supplied inputs.
 */
function buildSphere(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as SphereShape;
  return revolveProfile(
    oc,
    sphereProfile(shape.radius, shape.segments),
    op.span,
  );
}

/**
 * Builds torus from the supplied inputs.
 */
function buildTorus(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as Extract<
    IRSolidPrimitiveShape,
    { primitive: 'torus' }
  >;
  return revolveProfile(
    oc,
    torusProfile(shape.majorRadius, shape.minorRadius, shape.minorSegments),
    op.span,
  );
}

/**
 * Builds ellipsoid from the supplied inputs.
 */
function buildEllipsoid(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as Extract<
    IRSolidPrimitiveShape,
    { primitive: 'ellipsoid' }
  >;
  return revolveProfile(
    oc,
    ellipsoidProfile(shape.radius[0], shape.radius[2], shape.segments),
    op.span,
  );
}

/**
 * Builds elliptic cylinder from the supplied inputs.
 */
function buildEllipticCylinder(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as Extract<
    IRSolidPrimitiveShape,
    { primitive: 'cylinderElliptic' }
  >;
  return polyhedronCompound(
    oc,
    ellipticCylinderMesh(
      shape.startRadius,
      shape.endRadius,
      shape.height,
      shape.segments,
    ),
    op.span,
  );
}

/**
 * Builds polyhedron from the supplied inputs.
 */
function buildPolyhedron(oc: OC, op: IRSolidPrimitive): OC {
  const shape = op.shape as Extract<
    IRSolidPrimitiveShape,
    { primitive: 'polyhedron' }
  >;
  return polyhedronCompound(
    oc,
    { points: shape.points, faces: shape.faces },
    op.span,
  );
}

/**
 * Builds the primitive data required by the current operation.
 */
export function primitiveGrowsFromPlane(op: IRSolidPrimitive): boolean {
  return ![
    'sphere',
    'ellipsoid',
    'geodesicSphere',
    'torus',
    'polyhedron',
  ].includes(op.shape.primitive);
}
