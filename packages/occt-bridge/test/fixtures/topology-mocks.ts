/**
 * @author Aidan Boissonneault
 * @file topology-mocks.ts
 * @purpose Tests topology mocks behavior in the fixtures in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { vi } from 'vitest';
import { FaceLabelMap } from '../../src/topology/face-labels.js';
import type { GroupBuildState, OC } from '../../src/bridge/bridge-types.js';
import { createGroupBuildState } from '../../src/bridge/group-build-state.js';

export const SPAN = { file: 'test.bscd', line: 1, col: 1 };

/**
 * Creates a test double for point.
 */
function mockPoint(x: number, y: number, z: number) {
  return { X: () => x, Y: () => y, Z: () => z, delete: vi.fn() };
}

/**
 * Creates a test double for dir.
 */
function mockDir(x: number, y: number, z: number) {
  return { X: () => x, Y: () => y, Z: () => z, delete: vi.fn() };
}

/**
 * Creates a test double for axis.
 */
function mockAxis() {
  return {
    Location: () => mockPoint(0, 0, 0),
    Direction: () => mockDir(0, 0, 1),
    XDirection: () => mockDir(1, 0, 0),
    YDirection: () => mockDir(0, 1, 0),
    delete: vi.fn(),
  };
}

/**
 * Creates a test double for shape.
 */
export function mockShape(tag: string, edges: unknown[] = []) {
  return {
    _tag: tag,
    _edges: edges,
    IsNull: () => false,
    IsSame: (other: { _tag?: string }) => other?._tag === tag,
    IsEqual: (other: { _tag?: string }) => other?._tag === tag,
    delete: vi.fn(),
  };
}

/**
 * Creates a test double for constructor.
 */
function mockConstructor<Args extends unknown[], Result>(
  factory: (...args: Args) => Result,
) {
  return vi.fn(function (this: unknown, ...args: Args) {
    return factory(...args);
  });
}

/**
 * Creates a test double for edge.
 */
export function mockEdge(
  tag: string,
  first: [number, number, number],
  last: [number, number, number],
) {
  return {
    ...mockShape(tag),
    _first: { _point: mockPoint(...first), delete: vi.fn() },
    _last: { _point: mockPoint(...last), delete: vi.fn() },
  };
}

/** Creates the narrow OCCT surface needed by topology-label unit tests. */
export function makeMockOC(transformResults = new Map<unknown, unknown>()): OC {
  const oc = {
    TopAbs_ShapeEnum: { TopAbs_FACE: 4, TopAbs_EDGE: 6, TopAbs_SHAPE: 0 },
    TopAbs_Orientation: { TopAbs_REVERSED: 1 },
    gp_Pnt_3: mockConstructor(() => mockPoint(0, 0, 0)),
    gp_Dir_4: mockConstructor((x: number, y: number, z: number) =>
      mockDir(x, y, z),
    ),
    gp_Ax2_2: mockConstructor(mockAxis),
    gp_Ax3_2: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Trsf_1: mockConstructor(() => ({
      SetDisplacement: vi.fn(),
      delete: vi.fn(),
    })),
    BRepBuilderAPI_Transform_2: mockConstructor((shape: unknown) => ({
      IsDone: () => true,
      Shape: () => transformResults.get(shape) ?? mockShape('transformed'),
      delete: vi.fn(),
    })),
    TopExp_Explorer_2: mockConstructor((shape: { _edges?: unknown[] }) => {
      const items = shape._edges ?? [];
      let index = 0;
      return {
        More: () => index < items.length,
        Next: () => {
          index++;
        },
        Current: () => items[index],
        delete: vi.fn(),
      };
    }),
    TopoDS: {
      Edge_1: vi.fn((shape: unknown) => shape),
      Face_1: vi.fn((shape: unknown) => shape),
    },
    TopExp: {
      FirstVertex: vi.fn((edge: { _first?: unknown }) => edge._first),
      LastVertex: vi.fn((edge: { _last?: unknown }) => edge._last),
    },
    BRep_Tool: {
      Pnt: vi.fn((vertex: { _point?: unknown }) => vertex._point),
    },
    BRepBndLib: { Add: vi.fn() },
    Bnd_Box_1: mockConstructor(() => ({
      Get: vi.fn(
        (
          xMin: { current: number },
          yMin: { current: number },
          zMin: { current: number },
          xMax: { current: number },
          yMax: { current: number },
          zMax: { current: number },
        ) => {
          xMin.current = 0;
          yMin.current = 0;
          zMin.current = 0;
          xMax.current = 10;
          yMax.current = 10;
          zMax.current = 10;
        },
      ),
      delete: vi.fn(),
    })),
  };
  return oc as unknown as OC;
}

/** Builds the shared state fields required by isolated bridge operations. */
export function minimalState(labelMap: FaceLabelMap): GroupBuildState {
  const state = createGroupBuildState(new FaceLabelMap(), 'XY');
  state.labelMap = labelMap;
  return state;
}
