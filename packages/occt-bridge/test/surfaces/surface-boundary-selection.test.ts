/**
 * @author Aidan Boissonneault
 * @file surface-boundary-selection.test.ts
 * @purpose Tests surface boundary selection behavior in the surfaces in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { GroupBuildState, OC } from '../../src/bridge/bridge-types.js';
import type { ResolvedSelection } from '@bushscad/ir';
import { buildSurfaceFillOperation } from '../../src/surfaces/surfaces.js';
import { createOcctBuildTrace } from '../../src/operations/build-trace.js';

const SPAN = {
  file: 'surface-test.bscd',
  line: 1,
  col: 1,
  endLine: 1,
  endCol: 20,
};

/**
 * Builds state from the supplied inputs.
 */
function buildState(labelMap: object): GroupBuildState {
  return {
    bodyOwners: new Map(),
    bodyShapes: new Map([['plate', { kind: 'solid' }]]),
    sketchFaces: new Map(),
    surfaceShapes: new Map(),
    surfaceNormals: new Map(),
    surfaceMaterials: new Map(),
    labelMap,
  } as unknown as GroupBuildState;
}

/**
 * Handles selection in the surfaces flow.
 */
function selection(
  kind: 'face' | 'face-perimeter' | 'face-edges',
  label: string,
): ResolvedSelection {
  const topologyKind =
    kind === 'face' ? 'face' : kind === 'face-perimeter' ? 'loop' : 'edge';
  return {
    requestedKind: kind,
    ownerEntity: 'plate',
    sourceSpan: SPAN,
    targets: [
      {
        id: `plate:${kind}:${label}`,
        label,
        ownerEntity: 'plate',
        selectorKind: kind,
        topologyKind,
        source: { selectorSpan: SPAN, segmentSpans: [] },
      },
    ],
  };
}

describe('surface boundary selection', () => {
  it('builds a face from perimeter edges instead of returning the parent face', () => {
    const edge = { kind: 'outer-edge' };
    const wire = { kind: 'outer-wire' };
    const perimeterFace = { kind: 'perimeter-face' };
    const resolveEdges = vi.fn(() => [edge]);
    const state = buildState({
      getFaceHandles: vi.fn(() => [{ kind: 'parent-face' }]),
      getAllFaceHandles: vi.fn(() => []),
      resolveAxis: vi.fn(() => {
        throw new Error('normal unavailable in unit mock');
      }),
      resolveEdges,
    });
    state.trace = createOcctBuildTrace();
    const addEdge = vi.fn();
    const oc = {
      BRepBuilderAPI_MakeWire_1: vi.fn(function () {
        return { Add_1: addEdge, IsDone: () => true, Wire: () => wire };
      }),
      BRepBuilderAPI_MakeFace_15: vi.fn(function () {
        return { IsDone: () => true, Face: () => perimeterFace };
      }),
    } as unknown as OC;

    buildSurfaceFillOperation(oc, state, {
      kind: 'surface',
      name: 'skin',
      boundary: 'plate.top.perimeter',
      selection: selection('face-perimeter', 'plate.top.perimeter'),
      material: null,
      span: SPAN,
    });

    expect(resolveEdges).toHaveBeenCalledWith(oc, 'plate.top.perimeter');
    expect(addEdge).toHaveBeenCalledWith(edge);
    expect(state.surfaceShapes.get('skin')).toBe(perimeterFace);
    expect(state.trace.events).toContainEqual(
      expect.objectContaining({
        kind: 'selector-resolution',
        selectorPhase: 'realized',
        requestedSelectorKind: 'face-perimeter',
        resolvedTopologyKind: 'loop',
        matchCount: 1,
      }),
    );
  });

  it('preserves every loop when a whole face is selected', () => {
    const parentFace = { kind: 'parent-face-with-inner-wire' };
    const resolveEdges = vi.fn(() => []);
    const state = buildState({
      getFaceHandles: vi.fn(() => [parentFace]),
      getAllFaceHandles: vi.fn(() => []),
      resolveAxis: vi.fn(() => {
        throw new Error('normal unavailable in unit mock');
      }),
      resolveEdges,
    });

    buildSurfaceFillOperation({} as OC, state, {
      kind: 'surface',
      name: 'skin',
      boundary: 'plate.top',
      selection: selection('face', 'plate.top'),
      material: null,
      span: SPAN,
    });

    expect(resolveEdges).not.toHaveBeenCalled();
    expect(state.surfaceShapes.get('skin')).toBe(parentFace);
  });

  it('rebuilds an edges fill with its outer and inner wires', () => {
    const outerWire = {
      id: 'outer',
      IsSame: (wire: { id: string }) => wire.id === 'outer',
    };
    const innerWire = {
      id: 'inner',
      IsSame: (wire: { id: string }) => wire.id === 'inner',
    };
    const wires = [outerWire, innerWire];
    let index = 0;
    const rebuiltFace = { kind: 'rebuilt-face' };
    const addWire = vi.fn();
    const state = buildState({
      getFaceHandles: vi.fn(() => [{ kind: 'parent-face' }]),
      getAllFaceHandles: vi.fn(() => []),
      resolveAxis: vi.fn(() => {
        throw new Error('normal unavailable in unit mock');
      }),
      resolveEdges: vi.fn(() => [{ kind: 'selected-edge' }]),
    });
    const oc = {
      BRepTools: { OuterWire: () => outerWire },
      BRepBuilderAPI_MakeFace_15: vi.fn(function () {
        return {
          Add: addWire,
          IsDone: () => true,
          Face: () => rebuiltFace,
        };
      }),
      TopAbs_ShapeEnum: { TopAbs_WIRE: 1, TopAbs_SHAPE: 2 },
      TopExp_Explorer_2: vi.fn(function () {
        return {
          More: () => index < wires.length,
          Current: () => wires[index],
          Next: () => index++,
        };
      }),
      TopoDS: { Wire_1: (wire: object) => wire },
    } as unknown as OC;

    buildSurfaceFillOperation(oc, state, {
      kind: 'surface',
      name: 'skin',
      boundary: 'plate.top.edges',
      selection: selection('face-edges', 'plate.top.edges'),
      material: null,
      span: SPAN,
    });

    expect(addWire).toHaveBeenCalledOnce();
    expect(addWire).toHaveBeenCalledWith(innerWire);
    expect(state.surfaceShapes.get('skin')).toBe(rebuiltFace);
  });
});
