/**
 * @author Aidan Boissonneault
 * @file profile-circle-wire.test.ts
 * @purpose Tests profile circle wire behavior in the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { IRProfileSegment } from '@bushscad/ir';
import type { OC } from '../../src/bridge/bridge-types.js';
import { buildProfileWireFromSegments } from '../../src/profiles/profile-faces.js';

describe('profile circle wire coalescing', () => {
  it('builds editor quadrant arcs as one circular OCCT edge', () => {
    const { oc, wire } = makeMockOc();

    const result = buildProfileWireFromSegments(oc, [
      arc('circle_1_q1', [10, 0], [0, 10]),
      arc('circle_1_q2', [0, 10], [-10, 0]),
      arc('circle_1_q3', [-10, 0], [0, -10]),
      arc('circle_1_q4', [0, -10], [10, 0]),
    ]);

    expect(result).toBe(wire);
    expect(oc.BRepBuilderAPI_MakeEdge_8).toHaveBeenCalledTimes(1);
    expect(oc.BRepBuilderAPI_MakeWire_2).toHaveBeenCalledTimes(1);
    expect(oc.BRepBuilderAPI_MakeEdge_9).not.toHaveBeenCalled();
  });

  it('coalesces shuffled arcs with one reversed declaration', () => {
    const { oc, wire } = makeMockOc();

    const result = buildProfileWireFromSegments(oc, [
      arc('q3', [-10, 0], [0, -10]),
      arc('q1', [0, 10], [10, 0], 10, true),
      arc('q4', [0, -10], [10, 0]),
      arc('q2', [0, 10], [-10, 0]),
    ]);

    expect(result).toBe(wire);
    expect(oc.BRepBuilderAPI_MakeEdge_8).toHaveBeenCalledTimes(1);
    expect(oc.BRepBuilderAPI_MakeEdge_9).not.toHaveBeenCalled();
  });

  it('keeps a large-radius chain with a visible gap as separate arcs', () => {
    const radius = 1e9;
    const { oc } = makeMockOc();

    buildProfileWireFromSegments(oc, [
      arc('q1', [radius, 0], [0, radius], radius),
      arc('q2', [0, radius], [-radius, 0], radius),
      arc('q3', [-radius, 0], [0, -radius], radius),
      arc('q4', [0, -radius + 0.5], [radius, 0], radius),
    ]);

    expect(oc.BRepBuilderAPI_MakeEdge_8).not.toHaveBeenCalled();
    expect(oc.BRepBuilderAPI_MakeEdge_9).toHaveBeenCalledTimes(4);
    expect(oc.BRepBuilderAPI_MakeWire_1).toHaveBeenCalledTimes(1);
  });

  it('retains a fractional center for a very large exact circle', () => {
    const center: [number, number] = [0.1234, 0.2345];
    const radius = 1e9;
    const points = [
      [center[0] + radius, center[1]],
      [center[0], center[1] + radius],
      [center[0] - radius, center[1]],
      [center[0], center[1] - radius],
    ] as [number, number][];
    const { oc } = makeMockOc();

    buildProfileWireFromSegments(
      oc,
      points.map((from, index) =>
        arc(`q${index + 1}`, from, points[(index + 1) % points.length], radius),
      ),
    );

    const origin = vi.mocked(oc.gp_Pnt_3).mock.calls[0];
    expect(origin[0]).toBeCloseTo(center[0], 6);
    expect(origin[1]).toBeCloseTo(center[1], 6);
  });
});

/**
 * Creates an arc from its center, radius, and angular limits.
 */
function arc(
  name: string,
  from: [number, number],
  to: [number, number],
  radius = 10,
  clockwise = false,
): IRProfileSegment {
  return { kind: 'arc', name, from, to, radius, clockwise };
}

/**
 * Constructs mock oc from the supplied values.
 */
function makeMockOc(): { oc: OC; wire: unknown } {
  const edge = deletable('edge');
  const wire = deletable('wire');
  const edgeMaker = { Edge: vi.fn(() => edge) };
  const wireMaker = { Wire: vi.fn(() => wire) };
  return {
    wire,
    oc: {
      gp_Pnt_3: constructor(() => deletable('point')),
      gp_Dir_4: constructor(() => deletable('dir')),
      gp_Ax2_2: constructor(() => deletable('axis')),
      gp_Circ_2: constructor(() => deletable('circle')),
      BRepBuilderAPI_MakeEdge_8: constructor(() => edgeMaker),
      BRepBuilderAPI_MakeWire_2: constructor(() => wireMaker),
      BRepBuilderAPI_MakeEdge_9: constructor(() => ({
        Edge: vi.fn(() => edge),
      })),
      BRepBuilderAPI_MakeWire_1: constructor(() => ({
        Add_1: vi.fn(),
        Wire: vi.fn(() => wire),
        delete: vi.fn(),
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
