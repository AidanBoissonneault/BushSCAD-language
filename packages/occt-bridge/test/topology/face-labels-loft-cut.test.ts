/**
 * @author Aidan Boissonneault
 * @file face-labels-loft-cut.test.ts
 * @purpose Tests face labels loft cut behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import { FaceLabelMap } from '../../src/topology/face-labels.js';

/**
 * vec3 represented by [number, number, number].
 */
type Vec3 = [number, number, number];

/**
 * B box, including x min, y min, z min, x max, and y max.
 */
type BBox = {
  xMin: number;
  yMin: number;
  zMin: number;
  xMax: number;
  yMax: number;
  zMax: number;
};

/**
 * Mock point, including X coordinate, Y coordinate, Z coordinate, and native-resource cleanup
 * function.
 */
type MockPoint = {
  X(): number;
  Y(): number;
  Z(): number;
  delete(): void;
};

/**
 * Mock shape, including name, _bbox, _faces, _edges, and _normal.
 */
type MockShape = {
  name: string;
  _bbox: BBox;
  _faces?: MockShape[];
  _edges?: MockShape[];
  _normal?: Vec3;
  _center?: MockPoint;
  _first?: { _point: MockPoint; delete(): void };
  _last?: { _point: MockPoint; delete(): void };
  _solidCutToolKind?: string;
  IsSame(other: unknown): boolean;
  IsEqual(other: unknown): boolean;
  delete(): void;
};

describe('FaceLabelMap loft cut edge selectors', () => {
  it('selects the interior floor rim instead of the loft boundary loop', () => {
    const oc = makeMockOC();
    const loftBoundary = mockClosedEdge('loft-boundary-loop', 62.5, 5);
    const capLoop = mockClosedEdge('cut-floor-cap-loop', 58.5, 5);
    const wallFloorEdge = mockClosedEdge('cut-wall-floor-edge', 58.5, 5);
    const sourceBottom = mockClosedEdge('source-bottom-profile', 62.5, 5);

    const cutResult = mockShape('cut-result', {
      bbox: [-67.5, -67.5, 0, 67.5, 67.5, 30],
      faces: [
        mockFace(
          'result-bottom',
          [0, 0, -1],
          [0, 0, 5],
          [loftBoundary, capLoop],
        ),
        mockFace('result-wall', [1, 0, 0], [58.5, 0, 12], [wallFloorEdge]),
      ],
      edges: [loftBoundary, capLoop, wallFloorEdge],
    });
    const loftTool = mockShape('loft-tool', {
      bbox: [-62.5, -62.5, 5, 62.5, 62.5, 30],
      faces: [mockFace('tool-bottom', [0, 0, -1], [0, 0, 5], [sourceBottom])],
      edges: [sourceBottom],
    });
    loftTool._solidCutToolKind = 'loft';

    const labelMap = new FaceLabelMap();
    labelMap.register(oc, 'tray_cut', cutResult, 'inner', undefined, loftTool);

    expect(labelMap.resolveEdges(oc, 'tray_cut.bottom.edges')).toEqual([
      wallFloorEdge,
    ]);
  });
});

/**
 * Constructs mock oc from the supplied values.
 */
function makeMockOC() {
  return {
    TopAbs_ShapeEnum: { TopAbs_FACE: 4, TopAbs_EDGE: 6, TopAbs_SHAPE: 0 },
    TopExp_Explorer_2: mockConstructor(
      (shape: MockShape, shapeType: number) => {
        const items =
          shapeType === 4 ? (shape._faces ?? []) : (shape._edges ?? []);
        let index = 0;
        return {
          More: () => index < items.length,
          Next: vi.fn(() => {
            index++;
          }),
          Current: () => items[index],
          delete: vi.fn(),
        };
      },
    ),
    TopoDS: {
      Face_1: (shape: MockShape) => shape,
      Edge_1: (shape: MockShape) => shape,
    },
    TopExp: {
      FirstVertex: (edge: MockShape) => edge._first,
      LastVertex: (edge: MockShape) => edge._last,
    },
    BRep_Tool: {
      Pnt: (vertex: { _point: MockPoint }) => vertex._point,
    },
    Bnd_Box_1: mockConstructor(() => {
      const box: {
        shape?: MockShape;
        Get: (...args: Array<{ current: number }>) => void;
        delete(): void;
      } = {
        Get: (xMin, yMin, zMin, xMax, yMax, zMax) => {
          const bbox = box.shape?._bbox ?? bboxFromTuple([0, 0, 0, 0, 0, 0]);
          xMin.current = bbox.xMin;
          yMin.current = bbox.yMin;
          zMin.current = bbox.zMin;
          xMax.current = bbox.xMax;
          yMax.current = bbox.yMax;
          zMax.current = bbox.zMax;
        },
        delete: vi.fn(),
      };
      return box;
    }),
    BRepBndLib: {
      Add: (shape: MockShape, box: { shape?: MockShape }) => {
        box.shape = shape;
      },
    },
    BRepGProp_Face_2: mockConstructor((face: MockShape) => ({
      Bounds: vi.fn(),
      Normal: vi.fn(
        (_u: unknown, _v: unknown, _p: unknown, normal: MutableVector) => {
          const [x, y, z] = face._normal ?? [0, 0, 1];
          normal.X = () => x;
          normal.Y = () => y;
          normal.Z = () => z;
        },
      ),
      delete: vi.fn(),
    })),
    gp_Pnt_1: mockConstructor(() => mockPoint(0, 0, 0)),
    gp_Vec_1: mockConstructor(() => mutableVector(0, 0, 1)),
    GProp_GProps_1: mockConstructor(() => {
      const props: {
        center: MockPoint;
        CentreOfMass(): MockPoint;
        delete(): void;
      } = {
        center: mockPoint(0, 0, 0),
        CentreOfMass: () => props.center,
        delete: vi.fn(),
      };
      return props;
    }),
    BRepGProp: {
      SurfaceProperties_1: (face: MockShape, props: { center: MockPoint }) => {
        props.center = face._center ?? mockPoint(0, 0, 0);
      },
    },
  };
}

/**
 * Mutable vector, including X coordinate, Y coordinate, Z coordinate, and native-resource
 * cleanup function.
 */
type MutableVector = {
  X(): number;
  Y(): number;
  Z(): number;
  delete(): void;
};

/**
 * Creates a test double for constructor.
 */
function mockConstructor<Args extends unknown[], Result>(
  factory: (...args: Args) => Result,
): ReturnType<typeof vi.fn> {
  return vi.fn(function (this: unknown, ...args: Args) {
    void this;
    return factory(...args);
  }) as ReturnType<typeof vi.fn>;
}

/**
 * Creates a test double for shape.
 */
function mockShape(
  name: string,
  options: {
    bbox: [number, number, number, number, number, number];
    faces?: MockShape[];
    edges?: MockShape[];
  },
): MockShape {
  const shape = {
    name,
    _bbox: bboxFromTuple(options.bbox),
    _faces: options.faces,
    _edges: options.edges,
    IsSame: (other: unknown) => other === shape,
    IsEqual: (other: unknown) => other === shape,
    delete: vi.fn(),
  };
  return shape;
}

/**
 * Creates a test double for face.
 */
function mockFace(
  name: string,
  normal: Vec3,
  center: Vec3,
  edges: MockShape[],
): MockShape {
  return {
    ...mockShape(name, { bbox: boundsForEdges(edges), edges }),
    _normal: normal,
    _center: mockPoint(...center),
  };
}

/**
 * Creates a test double for closed edge.
 */
function mockClosedEdge(name: string, radius: number, z: number): MockShape {
  const point = mockPoint(radius, 0, z);
  return {
    ...mockShape(name, {
      bbox: [-radius, -radius, z, radius, radius, z],
      edges: [],
    }),
    _first: { _point: point, delete: vi.fn() },
    _last: { _point: point, delete: vi.fn() },
  };
}

/**
 * Creates a test double for point.
 */
function mockPoint(x: number, y: number, z: number): MockPoint {
  return { X: () => x, Y: () => y, Z: () => z, delete: vi.fn() };
}

/**
 * Handles mutable vector in the topology flow.
 */
function mutableVector(x: number, y: number, z: number): MutableVector {
  return { X: () => x, Y: () => y, Z: () => z, delete: vi.fn() };
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsForEdges(
  edges: MockShape[],
): [number, number, number, number, number, number] {
  return [
    Math.min(...edges.map((edge) => edge._bbox.xMin)),
    Math.min(...edges.map((edge) => edge._bbox.yMin)),
    Math.min(...edges.map((edge) => edge._bbox.zMin)),
    Math.max(...edges.map((edge) => edge._bbox.xMax)),
    Math.max(...edges.map((edge) => edge._bbox.yMax)),
    Math.max(...edges.map((edge) => edge._bbox.zMax)),
  ];
}

/**
 * Handles bbox from tuple in the topology flow.
 */
function bboxFromTuple([xMin, yMin, zMin, xMax, yMax, zMax]: [
  number,
  number,
  number,
  number,
  number,
  number,
]): BBox {
  return { xMin, yMin, zMin, xMax, yMax, zMax };
}
