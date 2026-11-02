/**
 * @author Aidan Boissonneault
 * @file part-group-orchestration.ts
 * @purpose Provides part group orchestration behavior for the bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { Workplane } from '@bushscad/ir';
import type { BuiltPart, OC } from './bridge-types.js';
import type { PartGroup } from '../core/program-utils.js';
import { occtError } from '../core/occt-errors.js';
import { deleteBuiltPartShapes } from '../mesh/material-shapes.js';
import type { OcctBuildTrace } from '../operations/build-trace.js';
import { pushTraceEvent } from '../operations/build-trace.js';
import { groupDependencyNames } from '../topology/dependency-names.js';
import { FaceLabelMap } from '../topology/face-labels.js';
import { workplaneFrame } from '../topology/frame-utils.js';

/**
 * Defines the `BuildPartGroup` callback contract used by the bridge layer.
 */
export type BuildPartGroup = (
  group: PartGroup,
  globalLabels: FaceLabelMap,
  workplane: Workplane,
  trace?: OcctBuildTrace,
) => Omit<BuiltPart, 'group'>;

/**
 * Builds part groups in dependency order while returning them in source order.
 * Dependency traversal and global label publication define the serial
 * compatibility boundary used by classic builds and parallel whole-part work.
 */
export function buildPartGroups(
  oc: OC,
  groups: PartGroup[],
  workplane: Workplane,
  buildGroup: BuildPartGroup,
  trace?: OcctBuildTrace,
): { parts: BuiltPart[]; globalLabels: FaceLabelMap } {
  const globalLabels = new FaceLabelMap();
  const explicitNames = new Set(
    groups
      .filter((group) => group.name !== '__default__')
      .map((group) => group.name),
  );
  const indexByName = new Map(
    groups.map((group, index) => [group.name, index]),
  );
  const builtByIndex = new Map<number, BuiltPart>();
  const buildOrder: BuiltPart[] = [];
  const building = new Set<number>();

  /**
   * Builds at from the supplied inputs.
   */
  const buildAt = (index: number): void => {
    if (builtByIndex.has(index)) return;
    const group = groups[index];
    if (building.has(index)) throw cyclicPartError(group);
    building.add(index);
    for (const name of groupDependencyNames(group, explicitNames)) {
      const dependencyIndex = indexByName.get(name);
      if (dependencyIndex !== undefined) buildAt(dependencyIndex);
    }
    const built = buildOneGroup(
      oc,
      group,
      globalLabels,
      workplane,
      buildGroup,
      trace,
    );
    builtByIndex.set(index, built);
    buildOrder.push(built);
    building.delete(index);
  };

  try {
    groups.forEach((_, index) => buildAt(index));
    return {
      parts: groups.map((_, index) => builtByIndex.get(index) as BuiltPart),
      globalLabels,
    };
  } catch (error) {
    deleteBuiltPartShapes(buildOrder);
    throw error;
  }
}

/**
 * Builds one group from the supplied inputs.
 */
function buildOneGroup(
  oc: OC,
  group: PartGroup,
  globalLabels: FaceLabelMap,
  workplane: Workplane,
  buildGroup: BuildPartGroup,
  trace?: OcctBuildTrace,
): BuiltPart {
  pushTraceEvent(trace, { kind: 'part-start', partName: group.name });
  const startedAt = Date.now();
  const built = { group, ...buildGroup(group, globalLabels, workplane, trace) };
  if (group.name !== '__default__') {
    globalLabels.register(
      oc,
      group.name,
      built.shape,
      'outer',
      workplaneFrame(workplane),
    );
  }
  pushTraceEvent(trace, {
    kind: 'part-success',
    partName: group.name,
    elapsedMs: Date.now() - startedAt,
  });
  return built;
}

/**
 * Handles cyclic part error in the bridge flow.
 */
function cyclicPartError(group: PartGroup): Error {
  return occtError(
    `Cyclic part reference involving '${group.name}'`,
    group.ops[0]?.span ?? { file: '(occt)', line: 1, col: 1 },
  );
}
