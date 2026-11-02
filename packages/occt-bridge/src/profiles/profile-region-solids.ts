/**
 * @author Aidan Boissonneault
 * @file profile-region-solids.ts
 * @purpose Provides profile region solids behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IRClosedBody,
  IRPrimitive,
  IRProfileBodySelection,
  SourceSpan,
} from '@bushscad/ir';
import { detectProfileLoops, profileSelectionSource } from '@bushscad/ir';
import { applyStableBoolFuse } from '../operations/boolean-operations.js';
import type { OC } from '../bridge/bridge-types.js';
import { occtError } from '../core/occt-errors.js';
import {
  buildProfileBodySolid,
  type ProfileLoopExtrudeOptions,
  type ProfileLoopSolidResult,
} from './profile-loop-solids.js';

/**
 * The profile variant of an IR primitive, used where sketch-preview code needs profile-specific
 * geometry.
 */
type ProfilePrimitive = Extract<IRPrimitive, { kind: 'profile' }>;

/**
 * Derives `ProfileRegionExtrudeOptions` from `ProfileLoopExtrudeOptions & { primitive:
 * ProfilePrimitive; selectedNames?: string[]; }` to preserve its type relationship in the profiles
 * layer.
 */
type ProfileRegionExtrudeOptions = ProfileLoopExtrudeOptions & {
  primitive: ProfilePrimitive;
  selectedNames?: string[];
};

/**
 * Type used for result of profile region extrude.
 */
export type ProfileRegionExtrudeResult = ProfileLoopSolidResult;

/**
 * Decides whether closed-body filtering requires exact solid-region booleans.
 * Expression aliases can span several atomic regions, so every selected alias
 * uses exact solid construction. Legacy simple one-loop selections keep their
 * cheaper face path, while ignored/overlap regions remain exact as before.
 */
export function profileNeedsExactRegionSolid(
  primitive: IRPrimitive | undefined,
  selectedNames?: string[],
): boolean {
  const profile = profileSelectionSource(primitive)?.profile;
  if (!profile) return false;
  const bodies = profile.closedBodies ?? [];
  if (selectedNames?.length) {
    return selectedNames.some((name) => {
      const namedBodies = legacyBodiesNamed(bodies, name);
      if (namedBodies.length > 0) return namedBodies.some(bodyNeedsExactSolid);
      if (selectionByName(profile, name)) return true;
      return legacyBodiesWithId(bodies, name).some(bodyNeedsExactSolid);
    });
  }
  return bodies.some((body) => body.ignored);
}

/**
 * Builds exact extruded closed-body regions from original profile loops.
 * Each expression alias is a group of atomic regions. Its regions are built
 * exactly and stably fused so `a + b` produces one clean selected body instead
 * of a compound with internal seams. A same-sketch selector list is one set
 * union, so overlapping aliases cannot emit the same atomic solid twice.
 */
export function buildProfileRegionExtrudeSolid(
  options: ProfileRegionExtrudeOptions,
): ProfileRegionExtrudeResult {
  const loops = detectProfileLoops(options.primitive.segments);
  const groups = selectedProfileBodyGroups(
    options.primitive,
    options.selectedNames,
  );
  if (loops.length === 0 || groups.length === 0) {
    throw occtError('No closed bodies selected for profile', options.span);
  }
  const groupSolids = groups.map((bodies) =>
    buildBodyGroupSolid(options, loops, bodies),
  );
  return {
    shape: compoundSolids(
      options.oc,
      groupSolids.map((solid) => solid.shape),
      options.span,
    ),
    ...(groupSolids.some((solid) => solid.overlapped)
      ? { overlapped: true as const }
      : {}),
  };
}

/**
 * Resolves requested body names into atomic-region groups for extrusion.
 * A same-sketch body list denotes the union of its selections. Deduplicating
 * by stable atomic body id prevents nested or repeated aliases from producing
 * overlapping solids in the result compound.
 */
export function selectedProfileBodyGroups(
  primitive: ProfilePrimitive,
  selectedNames?: string[],
): IRClosedBody[][] {
  const bodies = primitive.closedBodies ?? [];
  if (!selectedNames?.length) {
    return bodies.filter((body) => !body.ignored).map((body) => [body]);
  }
  const selectedIds = new Set(
    selectedNames.flatMap((name) =>
      selectedBodiesByName(primitive, bodies, name).map((body) => body.id),
    ),
  );
  const selected = bodies.filter((body) => selectedIds.has(body.id));
  return selected.length > 0 ? [selected] : [];
}

/**
 * Returns the selected bodies by name from the current operation.
 */
function selectedBodiesByName(
  primitive: ProfilePrimitive,
  bodies: IRClosedBody[],
  name: string,
): IRClosedBody[] {
  const namedBodies = legacyBodiesNamed(bodies, name);
  if (namedBodies.length > 0) return namedBodies;
  const selection = selectionByName(primitive, name);
  return selection
    ? bodiesForSelection(bodies, selection)
    : legacyBodiesWithId(bodies, name);
}

/**
 * Handles selection by name in the profiles flow.
 */
function selectionByName(
  primitive: ProfilePrimitive,
  name: string,
): IRProfileBodySelection | undefined {
  return primitive.bodySelections?.find((selection) => selection.name === name);
}

/**
 * Handles bodies for selection in the profiles flow.
 */
function bodiesForSelection(
  bodies: IRClosedBody[],
  selection: IRProfileBodySelection,
): IRClosedBody[] {
  const ids = new Set(selection.bodyIds);
  return bodies.filter((body) => ids.has(body.id));
}

/**
 * Handles legacy bodies named in the profiles flow.
 */
function legacyBodiesNamed(
  bodies: IRClosedBody[],
  name: string,
): IRClosedBody[] {
  return bodies.filter((body) => body.name === name);
}

/**
 * Handles legacy bodies with ID in the profiles flow.
 */
function legacyBodiesWithId(
  bodies: IRClosedBody[],
  id: string,
): IRClosedBody[] {
  return bodies.filter((body) => body.id === id);
}

/**
 * Builds the body data required by the current operation.
 */
function bodyNeedsExactSolid(body: IRClosedBody): boolean {
  return (
    arrayLength(body.loopIds) !== 1 || arrayLength(body.excludedLoopIds) > 0
  );
}

/**
 * Handles array length in the profiles flow.
 */
function arrayLength(values: readonly unknown[] | undefined): number {
  return values?.length ?? 0;
}

/**
 * Builds body group solid from the supplied inputs.
 */
function buildBodyGroupSolid(
  options: ProfileRegionExtrudeOptions,
  loops: ReturnType<typeof detectProfileLoops>,
  bodies: IRClosedBody[],
): ProfileRegionExtrudeResult {
  const solids = bodies.map((body) =>
    buildProfileBodySolid(options, loops, body),
  );
  return {
    shape: fuseSolids(
      options.oc,
      solids.map((solid) => solid.shape),
      options.span,
    ),
    ...(solids.some((solid) => solid.overlapped)
      ? { overlapped: true as const }
      : {}),
  };
}

/**
 * Handles fuse solids in the profiles flow.
 */
function fuseSolids(oc: OC, solids: OC[], span: SourceSpan): OC {
  let result = firstSolid(solids, span);
  for (const solid of solids.slice(1)) {
    const next = applyStableBoolFuse(
      oc,
      result,
      solid,
      span,
      'Closed body union failed',
    );
    result.delete?.();
    solid.delete?.();
    result = next;
  }
  return result;
}

/**
 * Returns the first solid that matches the requested condition.
 */
function firstSolid(solids: OC[], span: SourceSpan): OC {
  if (solids.length === 0)
    throw occtError('No closed bodies selected for profile', span);
  return solids[0];
}

/**
 * Handles compound solids in the profiles flow.
 */
function compoundSolids(oc: OC, solids: OC[], span: SourceSpan): OC {
  if (solids.length === 0)
    throw occtError('No closed bodies selected for profile', span);
  if (solids.length === 1) return solids[0];
  const compound = new oc.TopoDS_Compound();
  const builder = new oc.BRep_Builder();
  builder.MakeCompound(compound);
  solids.forEach((solid) => builder.Add(compound, solid));
  solids.forEach((solid) => solid.delete?.());
  builder.delete?.();
  return compound;
}
