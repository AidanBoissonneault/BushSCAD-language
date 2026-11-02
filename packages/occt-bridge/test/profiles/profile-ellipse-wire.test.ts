/**
 * @author Aidan Boissonneault
 * @file profile-ellipse-wire.test.ts
 * @purpose Tests profile ellipse wire behavior in the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { IREllipseSegment } from '@bushscad/ir';
import type { OC } from '../../src/bridge/bridge-types.js';
import {
  buildXYEllipseEdge,
  buildXYEllipseWire,
} from '../../src/profiles/xy-ellipse.js';

describe('exact XY ellipse construction', () => {
  it('builds a horizontal-major compact ellipse as one exact edge', () => {
    const { oc, wire } = makeMockOc();

    expect(buildXYEllipseWire(oc, 40, 20, [3, -4])).toBe(wire);
    expect(oc.gp_Pnt_3).toHaveBeenCalledWith(3, -4, 0);
    expect(oc.gp_Elips_2).toHaveBeenCalledWith(expect.anything(), 20, 10);
    expect(oc.BRepBuilderAPI_MakeEdge_12).toHaveBeenCalledTimes(1);
    expect(oc.BRepBuilderAPI_MakeWire_2).toHaveBeenCalledTimes(1);
  });

  it('rotates the OCCT basis and parameters for a vertical-major ellipse', () => {
    const { oc } = makeMockOc();
    const segment: IREllipseSegment = {
      kind: 'ellipse',
      name: 'partial',
      center: [2, 5],
      radiusX: 4,
      radiusY: 9,
      from: [6, 5],
      to: [2, 14],
      startAngle: 0,
      endAngle: Math.PI / 2,
      clockwise: false,
      full: false,
    };

    buildXYEllipseEdge(oc, segment);

    expect(oc.gp_Dir_4).toHaveBeenNthCalledWith(2, 0, 1, 0);
    expect(oc.gp_Elips_2).toHaveBeenCalledWith(expect.anything(), 9, 4);
    expect(oc.BRepBuilderAPI_MakeEdge_13).toHaveBeenCalledWith(
      expect.anything(),
      -Math.PI / 2,
      0,
    );
  });
});

/**
 * Constructs mock oc from the supplied values.
 */
function makeMockOc(): { oc: OC; wire: unknown } {
  const edge = deletable('edge');
  const wire = deletable('wire');
  return {
    wire,
    oc: {
      gp_Pnt_3: constructor(() => deletable('point')),
      gp_Dir_4: constructor(() => deletable('direction')),
      gp_Ax2_2: constructor(() => deletable('axis')),
      gp_Elips_2: constructor(() => deletable('ellipse')),
      BRepBuilderAPI_MakeEdge_12: constructor(() => ({
        Edge: vi.fn(() => edge),
      })),
      BRepBuilderAPI_MakeEdge_13: constructor(() => ({
        Edge: vi.fn(() => edge),
      })),
      BRepBuilderAPI_MakeWire_2: constructor(() => ({
        Wire: vi.fn(() => wire),
      })),
    },
  };
}

/**
 * Creates an instance with the dependencies required by this class.
 */
function constructor<T>(factory: () => T): new (...args: unknown[]) => T {
  return vi.fn(function mockConstructor() {
    return factory();
  }) as unknown as new (...args: unknown[]) => T;
}

/**
 * Handles deletable in the profiles flow.
 */
function deletable(name: string): {
  name: string;
  delete: ReturnType<typeof vi.fn>;
} {
  return { name, delete: vi.fn() };
}
