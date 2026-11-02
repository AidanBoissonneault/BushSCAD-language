/**
 * @author Aidan Boissonneault
 * @file interaction-edge-descriptions.test.ts
 * @purpose Tests interaction edge descriptions behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { describeInteractionEdge } from '../../src/topology/interaction-edge-descriptions.js';

describe('interaction edge descriptions', () => {
  it('reports exact line endpoints and length', () => {
    const edge = fakeEdge([0, 0, 0], [3, 4, 0], 0, (u) => [3 * u, 4 * u, 0]);

    expect(describeInteractionEdge(fakeOc(), edge)).toBe(
      'line (0, 0, 0) → (3, 4, 0), length 5 mm',
    );
  });

  it('identifies a closed circular edge without relying on an index', () => {
    const edge = fakeEdge([2, 0, 1], [2, 0, 1], 1, (u) => [
      2 * Math.cos(u),
      2 * Math.sin(u),
      1,
    ]);

    expect(describeInteractionEdge(fakeOc(), edge)).toBe(
      'circle through (2, 0, 1), length ≈12.546 mm',
    );
  });
});

/**
 * point represented by [number, number, number].
 */
type Point = [number, number, number];
/**
 * Fake edge, including first, last, value kind, and point-sampling function.
 */
type FakeEdge = {
  first: Point;
  last: Point;
  type: number;
  pointAt: (parameter: number) => Point;
};

/**
 * Handles fake edge in the topology flow.
 */
function fakeEdge(
  first: Point,
  last: Point,
  type: number,
  pointAt: (parameter: number) => Point,
): FakeEdge {
  return { first, last, type, pointAt };
}

/**
 * Handles fake oc in the topology flow.
 */
function fakeOc() {
  /**
   * Owns `CurveAdapter` state and behavior for the topology layer.
   */
  class CurveAdapter {
    /**
     * Initializes the `CurveAdapter` instance with the values supplied by its caller.
     */
    constructor(private readonly edge: FakeEdge) {}
    /**
     * Returns type from the supplied input.
     */
    GetType() {
      return this.edge.type;
    }
    /**
     * Handles delete in the topology flow.
     */
    delete() {}
  }
  return {
    TopExp: {
      FirstVertex: (edge: FakeEdge) => edge.first,
      LastVertex: (edge: FakeEdge) => edge.last,
    },
    BRep_Tool: {
      Pnt: (point: Point) => coordinate(point),
      Curve_2: (
        edge: FakeEdge,
        first: { current: number },
        last: { current: number },
      ) => {
        first.current = 0;
        last.current = edge.type === 1 ? Math.PI * 2 : 1;
        return {
          get: () => ({
            Value: (parameter: number) => coordinate(edge.pointAt(parameter)),
          }),
          /**
           * Handles delete in the topology flow.
           */
          delete() {},
        };
      },
    },
    BRepAdaptor_Curve_2: CurveAdapter,
    GeomAbs_CurveType: {
      GeomAbs_Line: 0,
      GeomAbs_Circle: 1,
    },
  };
}

/**
 * Handles coordinate in the topology flow.
 */
function coordinate(point: Point) {
  return {
    X: () => point[0],
    Y: () => point[1],
    Z: () => point[2],
    /**
     * Handles delete in the topology flow.
     */
    delete() {},
  };
}
