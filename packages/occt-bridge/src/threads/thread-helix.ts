/**
 * @author Aidan Boissonneault
 * @file thread-helix.ts
 * @purpose Provides thread helix behavior for the threads in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRThread, SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import type { Vec3 } from '../core/geometry-utils.js';
import { occtError } from '../core/occt-errors.js';
import type { ThreadAxis } from './thread-axis.js';
import { makeClosedWireFromPoints } from './thread-wires.js';

/**
 * Helix spec, including axis, radius, pitch, extent, and direction.
 */
type HelixSpec = {
  axis: ThreadAxis;
  radius: number;
  pitch: number;
  extent: number;
  direction: Exclude<IRThread['direction'], 'regular'>;
  angleDeg: number | null;
};

/**
 * Helical thread profile, including inner radius, outer radius, inner width, outer width, and
 * end inset.
 */
type HelicalThreadProfile = {
  innerRadius: number;
  outerRadius: number;
  innerWidth: number;
  outerWidth: number;
  endInset?: number;
};

/**
 * Helix sample, including theta and z off.
 */
type HelixSample = {
  theta: number;
  zOff: number;
};

/**
 * Creates the swept cutter profile for internal or external helical threads.
 * Both thread types need a narrower neck at the root/minor radius and a broader
 * cutter at the outer/major radius. Internal threads still need enough
 * bore-side contact to visibly open every groove into the pilot bore.
 */
export function makeHelicalThreadCutProfile(
  threadType: IRThread['threadType'],
  crustR: number,
  valleyR: number,
  pitch: number,
  threadDepth: number,
): HelicalThreadProfile {
  const overlap = Math.max(0.03, threadDepth * 0.1);
  if (threadType === 'external') {
    return {
      innerRadius: valleyR,
      outerRadius: crustR + overlap,
      innerWidth: pitch * 0.14,
      outerWidth: pitch * 0.78,
    };
  }
  const boreOverlap = Math.max(0.03, threadDepth * 0.12);
  return {
    innerRadius: Math.max(0.01, crustR - boreOverlap),
    outerRadius: valleyR,
    innerWidth: pitch * 0.38,
    outerWidth: pitch * 0.7,
  };
}

/**
 * Creates the material profile used for modeled internal thread ridges.
 * Internal threads are more robust when modeled as material added back into a
 * major-radius bore. This avoids subtracting an open helical cutter through the
 * hole wall, which created patched or invisible render meshes.
 */
export function makeInternalThreadRidgeProfile(
  minorR: number,
  majorR: number,
  pitch: number,
  threadDepth: number,
): HelicalThreadProfile {
  const wallOverlap = Math.max(0.03, threadDepth * 0.12);
  return {
    innerRadius: minorR,
    outerRadius: majorR + wallOverlap,
    innerWidth: pitch * 0.16,
    outerWidth: pitch * 0.72,
    endInset: pitch * 0.42,
  };
}

/**
 * Builds a bounded helical groove cutter for visible handed threads.
 * build123d/bd_warehouse model thread geometry by lofting profile sections
 * along a helix. Doing the same here avoids the faceted pipe cutter that
 * punched periodic windows through cylinders instead of producing clean
 * thread-form grooves.
 */
export function buildHelicalThreadCutTool(
  oc: OC,
  span: SourceSpan,
  spec: HelixSpec,
  profile: HelicalThreadProfile,
): OC {
  const samples = helixSamples(spec, profile.endInset ?? 0);
  const wires = samples.map((sample) =>
    makeThreadSectionWire(oc, spec.axis, sample, profile, span),
  );
  try {
    return loftThreadSections(oc, wires, span);
  } finally {
    wires.forEach((wire) => wire.delete?.());
  }
}

/**
 * Handles helix samples in the threads flow.
 */
function helixSamples(spec: HelixSpec, endInset: number): HelixSample[] {
  const lead = leadPerTurn(spec.pitch, spec.angleDeg);
  const inset = Math.min(spec.extent * 0.45, Math.max(0, endInset));
  const activeExtent = Math.max(spec.extent - inset * 2, spec.pitch * 0.1);
  const turns = Math.max(activeExtent / Math.max(lead, spec.pitch * 0.1), 0.15);
  const targetSegments = Math.max(8, Math.ceil(turns * 10));
  const segments = Math.min(144, targetSegments);
  const handedSign = spec.direction === 'clockwise' ? 1 : -1;
  const samples: HelixSample[] = [];
  for (let i = 0; i <= segments; i++) {
    const progress = i / segments;
    const distance = inset + activeExtent * progress;
    const zOff = -distance;
    const theta = handedSign * (distance / lead) * Math.PI * 2;
    samples.push({ theta, zOff });
  }
  return samples;
}

/**
 * Resolves the physical thread lead from the user pitch.
 * Pitch is the usable axial distance per revolution. Letting angle override it
 * changes the actual thread count and makes ordinary M-style inputs render as
 * one or two giant wraps instead of repeated threads.
 */
function leadPerTurn(pitch: number, _angleDeg: number | null): number {
  return Math.max(pitch, 0.001);
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointAtRadius(
  axis: ThreadAxis,
  radius: number,
  theta: number,
  zOff: number,
): Vec3 {
  const radial = radialAt(axis, theta);
  const [topX, topY, topZ] = axis.top;
  const az = axis.axis;
  return [
    topX + radial[0] * radius + az[0] * zOff,
    topY + radial[1] * radius + az[1] * zOff,
    topZ + radial[2] * radius + az[2] * zOff,
  ];
}

/**
 * Handles radial at in the threads flow.
 */
function radialAt(axis: ThreadAxis, theta: number): Vec3 {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [
    axis.x[0] * c + axis.y[0] * s,
    axis.x[1] * c + axis.y[1] * s,
    axis.x[2] * c + axis.y[2] * s,
  ];
}

/**
 * Builds one thread-form section at a helix sample.
 * Lofting trapezoid sections creates a continuous V-thread cutter. The inner
 * and outer widths can be swapped for external versus internal threads while
 * preserving pitch as the usable axial spacing.
 */
function makeThreadSectionWire(
  oc: OC,
  axis: ThreadAxis,
  sample: HelixSample,
  profile: HelicalThreadProfile,
  span: SourceSpan,
): OC {
  const points = [
    pointAtRadius(
      axis,
      profile.innerRadius,
      sample.theta,
      sample.zOff - profile.innerWidth / 2,
    ),
    pointAtRadius(
      axis,
      profile.outerRadius,
      sample.theta,
      sample.zOff - profile.outerWidth / 2,
    ),
    pointAtRadius(
      axis,
      profile.outerRadius,
      sample.theta,
      sample.zOff + profile.outerWidth / 2,
    ),
    pointAtRadius(
      axis,
      profile.innerRadius,
      sample.theta,
      sample.zOff + profile.innerWidth / 2,
    ),
  ];
  return makeClosedWireFromPoints(
    oc,
    points,
    span,
    'Thread section wire failed',
  );
}

/**
 * Handles loft thread sections in the threads flow.
 */
function loftThreadSections(oc: OC, wires: OC[], span: SourceSpan): OC {
  if (wires.length < 2) throw occtError('Thread helix path failed', span);
  const loft = new oc.BRepOffsetAPI_ThruSections(true, false, 1e-6);
  loft.CheckCompatibility?.(false);
  for (const wire of wires) loft.AddWire(oc.TopoDS.Wire_1(wire));
  loft.Build();
  if (loft.IsDone && !loft.IsDone()) {
    loft.delete?.();
    throw occtError('Thread helix loft failed', span);
  }
  const shape = loft.Shape();
  loft.delete?.();
  return shape;
}
