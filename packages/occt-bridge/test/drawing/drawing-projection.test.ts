/**
 * @author Aidan Boissonneault
 * @file drawing-projection.test.ts
 * @purpose Tests drawing projection behavior in the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  computeViewBounds,
  projectShapeToClassifiedEdges,
  projectShapeToFaces,
} from '../../src/drawing/drawing-projection.js';
import { sampleWireToPoints } from '../../src/drawing/drawing-edge-sampling.js';
import { writeDxf } from '../../src/export/dxf-writer.js';
import { writeSvg } from '../../src/export/svg-writer.js';
import {
  buildExtentDimension,
  buildPointToFaceDimension,
} from '../../src/drawing/drawing-dimensions.js';

/**
 * point3 represented by [number, number, number].
 */
type Point3 = [number, number, number];

/**
 * Creates point geometry from the supplied coordinates.
 */
function point([x, y, z]: Point3) {
  return { X: () => x, Y: () => y, Z: () => z, delete: () => undefined };
}

/**
 * Resolves the edge data required by the current selector.
 */
function edge(a: Point3, b: Point3) {
  return {
    _first: { _point: point(a) },
    _last: { _point: point(b) },
    delete: () => undefined,
  };
}

/**
 * Handles wire in the drawing flow.
 */
function wire(edges: unknown[]) {
  const self = {
    _edges: edges,
    delete: () => undefined,
    IsSame: (other: unknown) => other === self,
  };
  return self;
}

/**
 * Constructs plate shape from the supplied values.
 */
function makePlateShape() {
  const outer = wire([
    edge([0, 0, 10], [60, 0, 10]),
    edge([60, 40, 10], [60, 0, 10]),
    edge([60, 40, 10], [0, 40, 10]),
    edge([0, 0, 10], [0, 40, 10]),
  ]);
  const hole = wire([
    edge([34, 20, 10], [30, 24, 10]),
    edge([30, 24, 10], [26, 20, 10]),
    edge([26, 20, 10], [30, 16, 10]),
    edge([30, 16, 10], [34, 20, 10]),
  ]);
  const top = {
    _normal: [0, 0, 1],
    _center: point([30, 20, 10]),
    _outer: outer,
    _wires: [outer, hole],
    _edges: [...outer._edges, ...hole._edges],
    delete: () => undefined,
  };
  return { _faces: [top], _edges: top._edges };
}

/**
 * Handles explorer in the drawing flow.
 */
function explorer(items: unknown[]) {
  let index = 0;
  return {
    More: () => index < items.length,
    Next: () => {
      index++;
    },
    Current: () => items[index],
    delete: () => undefined,
  };
}

/**
 * Constructs oc from the supplied values.
 */
function makeOc() {
  return {
    TopAbs_ShapeEnum: {
      TopAbs_FACE: 4,
      TopAbs_WIRE: 5,
      TopAbs_EDGE: 6,
      TopAbs_SHAPE: 0,
    },
    TopAbs_Orientation: { TopAbs_REVERSED: 1 },
    TopExp: {
      FirstVertex: (e: { _first: unknown }) => e._first,
      LastVertex: (e: { _last: unknown }) => e._last,
    },
    TopExp_Explorer_2: function (
      shape: { _faces?: unknown[]; _wires?: unknown[]; _edges?: unknown[] },
      type: number,
    ) {
      if (type === 4) return explorer(shape._faces ?? []);
      if (type === 5) return explorer(shape._wires ?? []);
      return explorer(shape._edges ?? []);
    },
    TopoDS: {
      Face_1: (v: unknown) => v,
      Wire_1: (v: unknown) => v,
      Edge_1: (v: unknown) => v,
    },
    BRepTools: { OuterWire: (face: { _outer: unknown }) => face._outer },
    BRep_Tool: { Pnt: (vertex: { _point: unknown }) => vertex._point },
    BRepGProp_Face_2: function (face: { _normal: Point3 }) {
      return {
        Bounds: (
          u1: { current: number },
          u2: { current: number },
          v1: { current: number },
          v2: { current: number },
        ) => {
          u1.current = 0;
          u2.current = 1;
          v1.current = 0;
          v2.current = 1;
        },
        Normal: (
          _u: number,
          _v: number,
          _p: unknown,
          out: { X?: () => number; Y?: () => number; Z?: () => number },
        ) => {
          const [x, y, z] = face._normal;
          out.X = () => x;
          out.Y = () => y;
          out.Z = () => z;
        },
        delete: () => undefined,
      };
    },
    gp_Pnt_1: function () {
      return { delete: () => undefined };
    },
    gp_Vec_1: function () {
      return { X: () => 0, Y: () => 0, Z: () => 0, delete: () => undefined };
    },
    GProp_GProps_1: function () {
      return {
        _center: point([0, 0, 0]),
        /**
         * Handles centre of mass in the drawing flow.
         */
        CentreOfMass() {
          return this._center;
        },
        delete: () => undefined,
      };
    },
    BRepGProp: {
      SurfaceProperties_1: (
        face: { _center: unknown },
        props: { _center: unknown },
      ) => {
        props._center = face._center;
      },
    },
  };
}

describe('drawing projection', () => {
  it('joins sampled wire edges in traversal order when edge directions differ', () => {
    const points = sampleWireToPoints(
      makeOc(),
      wire([edge([0, 0, 10], [10, 0, 10]), edge([20, 0, 10], [10, 0, 10])]),
      'top',
    );

    expect(points).toEqual([
      [0, 0],
      [10, 0],
      [20, 0],
    ]);
  });

  it('exports a top view with cut-hole detail and both dimensions', () => {
    const oc = makeOc();
    const shape = makePlateShape();
    const { visible, hidden } = projectShapeToClassifiedEdges(oc, shape, 'top');
    const faces = projectShapeToFaces(oc, shape, 'top', '#D0D0D0');
    const bounds = computeViewBounds([...visible, ...hidden]);
    const dims = [
      buildExtentDimension(
        { xMin: 0, xMax: 60, yMin: 0, yMax: 40, zMin: 0, zMax: 10 },
        'width',
        'top',
        6,
      ),
      buildPointToFaceDimension([30, 20], [0, 20], 6),
    ];

    expect(faces).toHaveLength(1);
    expect(faces[0].innerRings).toHaveLength(1);
    expect(faces[0].outerPoints).toEqual([
      [0, 0],
      [60, 0],
      [60, 40],
      [0, 40],
      [0, 0],
    ]);
    expect(visible).toHaveLength(8);

    const svg = writeSvg(visible, hidden, faces, dims, bounds, 1);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('30.0');
    expect(svg).toContain('60.0');

    const dxf = writeDxf(visible, dims, bounds, 1);
    expect(dxf.match(/\n0\nLINE/g)?.length).toBeGreaterThanOrEqual(10);
    expect(dxf).toContain('60.0');
    expect(dxf).toContain('30.0');
  });
});
