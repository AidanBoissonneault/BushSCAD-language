/**
 * @author Aidan Boissonneault
 * @file resolved-selection.ts
 * @purpose Provides resolved selection behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  ResolvedSelectionTarget,
  ResolvedSelectorKind,
} from '@bushscad/ir';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import { parseFaceRef } from '../core/program-utils.js';
import type { FaceDir } from '../core/program-utils.js';
import { pushTraceEvent } from '../operations/build-trace.js';
import { getEdges } from '../core/geometry-utils.js';
import {
  recordInteractionEdgeSelection,
  recordInteractionSelectionCount,
} from './interaction-selection-counts.js';
import { selectEdgeIntersection } from './edge-intersection-selection.js';
import { selectSketchComponentEdges } from './sketch-component-selection.js';

/**
 * Selection of realized topology, including display label, selector kind, faces, edges, and
 * sketch face.
 */
export type RealizedTopologySelection = {
  label: string;
  selectorKind: Exclude<ResolvedSelectorKind, 'expanded-selection'>;
  faces: OC[];
  edges: OC[];
  sketchFace?: OC;
  bodyShape?: OC;
};

/**
 * Realizes an explicit semantic selector as only its requested OCCT topology.
 * Face-first fallback used to erase `.edges` and `.perimeter`. This boundary
 * switches on selector kind before querying handles, while retaining a narrow
 * compatibility path for older IR that predates resolved-selection metadata.
 */
export function realizeTopologySelection(
  oc: OC,
  state: GroupBuildState,
  target: ResolvedSelectionTarget | undefined,
  compatibilityLabel: string,
): RealizedTopologySelection {
  const label = target?.label ?? compatibilityLabel;
  if (target?.selectorKind === 'edge-intersection') {
    return traced(oc, state, target, {
      label,
      selectorKind: target.selectorKind,
      faces: [],
      edges: selectEdgeIntersection(oc, state.labelMap, target)
        .selected as OC[],
    });
  }
  if (target?.sketchComponent) {
    return traced(oc, state, target, {
      label,
      selectorKind: target.selectorKind,
      faces: [],
      edges: selectSketchComponentEdges(oc, state.labelMap, target) as OC[],
    });
  }
  const parsed = parseFaceRef(label);
  const selectorKind = target?.selectorKind ?? inferLegacyKind(parsed);
  const names = selectionOwnerNames(state, parsed.objName);

  if (selectorKind === 'sketch-boundary') {
    return traced(oc, state, target, {
      label,
      selectorKind,
      faces: [],
      edges: [],
      sketchFace: firstDefined(names, (name) => state.sketchFaces.get(name)),
    });
  }
  if (selectorKind === 'bare-object') {
    return traced(oc, state, target, {
      label,
      selectorKind,
      faces: [],
      edges: [],
      bodyShape: firstDefined(names, (name) => state.bodyShapes.get(name)),
    });
  }
  if (selectorKind === 'face') {
    return traced(oc, state, target, {
      label,
      selectorKind,
      faces: firstNonEmpty(names, (name) =>
        parsed.face
          ? state.labelMap.getFaceHandles(
              name,
              parsed.face,
              parsed.qualifier ?? 'outer',
            )
          : state.labelMap.getAllFaceHandles(name),
      ) as OC[],
      edges: [],
    });
  }
  if (isEdgeOrLoopSelector(selectorKind)) {
    return traced(oc, state, target, {
      label,
      selectorKind,
      faces: [],
      edges: firstNonEmpty(names, (name) =>
        state.labelMap.resolveEdges(oc, labelForOwner(parsed, name)),
      ) as OC[],
    });
  }
  return traced(oc, state, target, {
    label,
    selectorKind,
    faces: [],
    edges: [],
  });
}

/**
 * Handles traced in the topology flow.
 */
function traced(
  oc: OC,
  state: GroupBuildState,
  target: ResolvedSelectionTarget | undefined,
  selection: RealizedTopologySelection,
): RealizedTopologySelection {
  if (target) {
    const matchCount =
      selection.faces.length +
      selection.edges.length +
      Number(selection.sketchFace !== undefined) +
      Number(selection.bodyShape !== undefined);
    const memberEdges = selection.edges.length
      ? selection.edges
      : target.selectorKind === 'sketch-boundary' && selection.sketchFace
        ? getEdges(oc, selection.sketchFace)
        : [];
    if (memberEdges.length > 0) {
      recordInteractionEdgeSelection(
        oc,
        state,
        state.labelMap,
        target,
        memberEdges,
      );
    } else {
      recordInteractionSelectionCount(state, target, matchCount);
    }
    pushTraceEvent(state.trace, {
      kind: 'selector-resolution',
      span: target.source.selectorSpan,
      requestedSelectorKind: target.selectorKind,
      resolvedTopologyKind: target.topologyKind,
      selectorLabel: target.label,
      matchCount,
      selectorPhase: 'realized',
    });
  }
  return selection;
}

/** Returns the parent face only for `.edges` loop classification after edges matched. */
export function supportingFaceForEdgeLoops(
  state: GroupBuildState,
  label: string,
): OC | undefined {
  const parsed = parseFaceRef(label);
  if (!parsed.face) return undefined;
  return firstNonEmpty(selectionOwnerNames(state, parsed.objName), (name) =>
    state.labelMap.getFaceHandles(
      name,
      parsed.face as FaceDir,
      parsed.qualifier ?? 'outer',
    ),
  )[0] as OC | undefined;
}

/**
 * Returns whether the input meets the `edge or loop selector` condition.
 */
function isEdgeOrLoopSelector(
  kind: Exclude<ResolvedSelectorKind, 'expanded-selection'>,
): boolean {
  return (
    kind === 'face-perimeter' ||
    kind === 'face-edges' ||
    kind === 'named-edge' ||
    kind === 'edge-intersection' ||
    kind === 'object-perimeter' ||
    kind === 'object-edges'
  );
}

/**
 * Handles infer legacy kind in the topology flow.
 */
function inferLegacyKind(
  parsed: ReturnType<typeof parseFaceRef>,
): Exclude<ResolvedSelectorKind, 'expanded-selection'> {
  if (parsed.subRef === 'edges') return 'face-edges';
  if (parsed.subRef === 'perimeter') return 'face-perimeter';
  if (parsed.subRef === 'edge') return 'named-edge';
  return parsed.face ? 'face' : 'sketch-boundary';
}

/**
 * Handles selection owner names in the topology flow.
 */
function selectionOwnerNames(
  state: GroupBuildState,
  requestedName: string,
): string[] {
  const owner = state.bodyOwners?.get(requestedName);
  return owner && owner !== requestedName
    ? [requestedName, owner]
    : [requestedName];
}

/**
 * Handles label for owner in the topology flow.
 */
function labelForOwner(
  parsed: ReturnType<typeof parseFaceRef>,
  objName: string,
): string {
  const parts = [objName];
  if (parsed.qualifier) parts.push(parsed.qualifier);
  if (parsed.face) parts.push(parsed.face);
  if (parsed.subRef) parts.push(parsed.subRef);
  if (parsed.cornerArg) parts.push(parsed.cornerArg);
  if (parsed.edgeArg) parts.push(parsed.edgeArg);
  return parts.join('.');
}

/**
 * Returns the first defined that matches the requested condition.
 */
function firstDefined<T>(
  names: string[],
  read: (name: string) => T | undefined,
): T | undefined {
  for (const name of names) {
    const value = read(name);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Returns the first non empty that matches the requested condition.
 */
function firstNonEmpty<T>(names: string[], read: (name: string) => T[]): T[] {
  for (const name of names) {
    const value = read(name);
    if (value.length > 0) return value;
  }
  return [];
}
