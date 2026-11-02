/**
 * @author Aidan Boissonneault
 * @file profile-open.ts
 * @purpose Provides profile open behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from '@bushscad/ir';
import { pointsDiffer } from './profile-utils.js';

/**
 * Reports whether a profile's solid-producing segments form an open loop.
 * Construction geometry can be selectable and constrainable, but it must not
 * prevent a closed sketch from producing a solid face for extrusion or cuts.
 */
export function isOpenProfile(prim: IRPrimitive): boolean {
  if (prim.kind !== 'profile') return false;
  const solidSegments = prim.segments.filter(
    (segment) => !segment.construction,
  );
  if (solidSegments.length === 0) return false;
  const first = solidSegments[0];
  const last = solidSegments[solidSegments.length - 1];
  return pointsDiffer(
    [first.from[0], first.from[1], 0],
    [last.to[0], last.to[1], 0],
  );
}
