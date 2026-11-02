/**
 * @author Aidan Boissonneault
 * @file part-deps.ts
 * @purpose Provides part deps behavior for the core in three renderer package.
 * @last-edited October 6, 2026
 */

import type { IRProgram, IROp } from '@bushscad/ir';

const DEFAULT_PART = '__default__';

const BODY_OUTPUT_KINDS = new Set<IROp['kind']>([
  'extrude',
  'revolve',
  'loft',
  'sweep',
  'sweep_cut',
  'solid_cut',
  'solidPrimitive',
  'importShape',
  'alignShape',
  'mirror',
  'patternLinear',
  'patternRadial',
  'transform',
  'rotate',
]);

/**
 * Part ownership, including all parts and part owner of obj.
 */
type PartOwnership = {
  allParts: Set<string>;
  partOwnerOfObj: Map<string, string>;
};

/**
 * Returns the set of part names whose bodies originate at the world (a
 * world/named plane or no placement) rather than being built off of an
 * object that belongs to a different part. Used by the renderer's
 * "Explode: Origin" mode to spread only top-level parts.
 *
 * A part is "derived" if any of its sketch placements (or extrude/cut
 * `from` placements) reference an objName owned by another part. The
 * remaining parts are considered origin-rooted.
 */
export function originRootedParts(program: IRProgram | null): Set<string> {
  if (!program) return new Set();

  const ownership = collectPartOwnership(program.ops);
  const derived = collectDerivedParts(program.ops, ownership.partOwnerOfObj);
  return withoutDerivedParts(ownership.allParts, derived);
}

/**
 * Collects part ownership from the supplied values.
 */
function collectPartOwnership(ops: IROp[]): PartOwnership {
  const partOwnerOfObj = new Map<string, string>();
  const allParts = new Set<string>();
  let currentPart = DEFAULT_PART;

  for (const op of ops) {
    if (op.kind === 'part') {
      currentPart = op.name;
      allParts.add(currentPart);
      // FaceRefs like `box.top.center` use the part name as the first
      // segment — register it so the second pass can resolve ownership.
      if (!partOwnerOfObj.has(currentPart)) {
        partOwnerOfObj.set(currentPart, currentPart);
      }
      continue;
    }
    const objName = bodyOutputName(op);
    if (objName) {
      allParts.add(currentPart);
      if (!partOwnerOfObj.has(objName)) {
        partOwnerOfObj.set(objName, currentPart);
      }
    }
  }
  return { allParts, partOwnerOfObj };
}

/**
 * Collects derived parts from the supplied values.
 */
function collectDerivedParts(
  ops: IROp[],
  partOwnerOfObj: Map<string, string>,
): Set<string> {
  const derived = new Set<string>();
  let currentPart = DEFAULT_PART;
  for (const op of ops) {
    if (op.kind === 'part') {
      currentPart = op.name;
      continue;
    }
    for (const ref of placementObjRefs(op)) {
      const owner = partOwnerOfObj.get(ref);
      if (owner && owner !== currentPart) {
        derived.add(currentPart);
        break;
      }
    }
  }
  return derived;
}

/**
 * Handles without derived parts in the core flow.
 */
function withoutDerivedParts(
  allParts: Set<string>,
  derived: Set<string>,
): Set<string> {
  const result = new Set<string>();
  for (const name of allParts) {
    if (!derived.has(name)) result.add(name);
  }
  return result;
}

/**
 * Builds the body data required by the current operation.
 */
function bodyOutputName(op: IROp): string | null {
  return BODY_OUTPUT_KINDS.has(op.kind)
    ? ((op as { objName?: string }).objName ?? null)
    : null;
}

/**
 * Handles placement obj refs in the core flow.
 */
function placementObjRefs(op: IROp): string[] {
  // A part is "derived" if its sketch is placed on, or its body is extruded
  // from, an objName owned by a different part. Both cases mean the part is
  // built off another object and should stay attached to it in Explode:
  // Origin mode.
  const refs: string[] = [];
  if (op.kind === 'sketch' && op.placement) {
    refs.push(firstSegment(op.placement.faceRef));
  }
  if (
    (op.kind === 'extrude' || op.kind === 'cut' || op.kind === 'solid_cut') &&
    op.from
  ) {
    refs.push(firstSegment(op.from.faceRef));
  }
  if (op.kind === 'solidPrimitive' && op.placement) {
    refs.push(firstSegment(op.placement.faceRef));
  }
  return refs;
}

/**
 * Returns the first segment that matches the requested condition.
 */
function firstSegment(faceRef: string): string {
  const i = faceRef.indexOf('.');
  return i < 0 ? faceRef : faceRef.slice(0, i);
}
