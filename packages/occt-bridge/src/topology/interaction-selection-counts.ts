/**
 * @author Aidan Boissonneault
 * @file interaction-selection-counts.ts
 * @purpose Provides interaction selection counts behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ResolvedSelectionTarget } from '@bushscad/ir';
import type { BuiltPart, GroupBuildState } from '../bridge/bridge-types.js';
import type { OC } from '../bridge/bridge-types.js';
import type { FaceLabelMap } from './face-labels.js';
import { describeInteractionEdges } from './interaction-edge-descriptions.js';

/**
 * Records how many topology members a selector actually resolved at execution.
 * A consuming operation can replace its input edges, so querying only the final
 * shape makes hover previews report later fragmentation instead of language
 * values. The resolved target id provides a stable compiler-to-bridge key.
 */
export function recordInteractionSelectionCount(
  state: GroupBuildState,
  target: ResolvedSelectionTarget | undefined,
  count: number,
): void {
  if (!target) return;
  state.interactionSelectionCounts ??= new Map();
  state.interactionSelectionCounts.set(target.id, count);
  state.interactionSelectionValues?.delete(target.id);
}

/** Records concrete descriptions for every edge hidden by a collection selector. */
export function recordInteractionEdgeSelection(
  oc: OC,
  state: GroupBuildState,
  labels: FaceLabelMap,
  target: ResolvedSelectionTarget | undefined,
  edges: readonly unknown[],
): void {
  recordInteractionSelectionCount(state, target, edges.length);
  if (!target) return;
  state.interactionSelectionValues ??= new Map();
  state.interactionSelectionValues.set(
    target.id,
    describeInteractionEdges(oc, labels, target.label, edges),
  );
}

/** Collects execution-time selector cardinalities from completed part builds. */
export function collectInteractionSelectionCounts(
  parts: readonly BuiltPart[],
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const part of parts) {
    for (const [selectionId, count] of part.interactionSelectionCounts) {
      counts.set(selectionId, count);
    }
  }
  return counts;
}

/** Collects concrete selector member descriptions from completed part builds. */
export function collectInteractionSelectionValues(
  parts: readonly BuiltPart[],
): ReadonlyMap<string, readonly string[]> {
  const values = new Map<string, readonly string[]>();
  for (const part of parts) {
    for (const [selectionId, members] of part.interactionSelectionValues) {
      values.set(selectionId, members);
    }
  }
  return values;
}
