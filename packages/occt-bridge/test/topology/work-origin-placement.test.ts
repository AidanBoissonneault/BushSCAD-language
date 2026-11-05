/**
 * @file work-origin-placement.test.ts
 * @purpose Tests work-origin axis resolution in the OCCT bridge.
 */

import { describe, expect, it } from 'vitest';
import { FaceLabelMap } from '../../src/topology/face-labels.js';

type Vector3 = [number, number, number];

class MockPoint {
  constructor(
    readonly x: number,
    readonly y: number,
    readonly z: number,
  ) {}

  X(): number {
    return this.x;
  }

  Y(): number {
    return this.y;
  }

  Z(): number {
    return this.z;
  }

  delete(): void {}
}

class MockDirection extends MockPoint {}

class MockAxis {
  constructor(
    readonly location: MockPoint,
    readonly direction: MockDirection,
    readonly xDirection: MockDirection,
  ) {}

  Location(): MockPoint {
    return this.location;
  }

  Direction(): MockDirection {
    return this.direction;
  }

  XDirection(): MockDirection {
    return this.xDirection;
  }

  delete(): void {}
}

const oc = {
  gp_Pnt_3: MockPoint,
  gp_Dir_4: MockDirection,
  gp_Ax2_2: MockAxis,
} as never;

function resolveOriginAxis(
  faceRef: string,
  workplane: 'XY' | 'XZ' | 'YZ',
  offsetX = 0,
  offsetY = 0,
  radius = 0,
  angleDeg = 0,
): MockAxis {
  return new FaceLabelMap().resolveAxis(oc, {
    faceRef,
    workplane,
    offsetX,
    offsetY,
    radius,
    angleDeg,
  }) as MockAxis;
}

function pointOf(axis: MockAxis): Vector3 {
  return [axis.location.X(), axis.location.Y(), axis.location.Z()];
}

function directionOf(axis: MockAxis): Vector3 {
  return [axis.direction.X(), axis.direction.Y(), axis.direction.Z()];
}

describe('work-origin placement axes', () => {
  it.each([
    ['XY', 'top', [0, 0, 1]],
    ['XY', 'bottom', [0, 0, -1]],
    ['XY', 'front', [0, -1, 0]],
    ['XY', 'back', [0, 1, 0]],
    ['XY', 'left', [-1, 0, 0]],
    ['XY', 'right', [1, 0, 0]],
    ['XZ', 'top', [0, -1, 0]],
    ['XZ', 'bottom', [0, 1, 0]],
    ['XZ', 'front', [0, 0, -1]],
    ['XZ', 'back', [0, 0, 1]],
    ['XZ', 'left', [-1, 0, 0]],
    ['XZ', 'right', [1, 0, 0]],
    ['YZ', 'top', [1, 0, 0]],
    ['YZ', 'bottom', [-1, 0, 0]],
    ['YZ', 'front', [0, 0, -1]],
    ['YZ', 'back', [0, 0, 1]],
    ['YZ', 'left', [0, -1, 0]],
    ['YZ', 'right', [0, 1, 0]],
  ] as const)(
    'resolves %s.%s with the expected world normal',
    (workplane, direction, expectedNormal) => {
      const axis = resolveOriginAxis(`origin.${direction}`, workplane);

      expect(directionOf(axis)).toEqual(expectedNormal);
    },
  );

  it.each([
    ['XY', [0, 0, 1], [2, 3, 0]],
    ['XZ', [0, -1, 0], [2, 0, 3]],
    ['YZ', [1, 0, 0], [0, 2, 3]],
  ] as const)(
    'uses the %s workplane for its top direction and Cartesian offsets',
    (workplane, expectedNormal, expectedPoint) => {
      const axis = resolveOriginAxis('origin.top', workplane, 2, 3);

      expect(directionOf(axis)).toEqual(expectedNormal);
      expect(pointOf(axis)).toEqual(expectedPoint);
    },
  );

  it('resolves polar offsets along the selected workplane direction', () => {
    const axis = resolveOriginAxis('origin.front', 'YZ', 0, 0, 10, 90);

    expect(directionOf(axis)).toEqual([0, 0, -1]);
    const point = pointOf(axis);
    expect(point[0]).toBeCloseTo(10);
    expect(point[1]).toBeCloseTo(0);
    expect(point[2]).toBeCloseTo(0);
  });
});
