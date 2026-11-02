/**
 * @author Aidan Boissonneault
 * @file center-plane-gimbal.test.ts
 * @purpose Tests center plane gimbal behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  centerPlaneAxisEndpoints,
  centerPlaneGimbalPresentation,
} from '../../src/scene/center-plane-gimbal.js';

describe('center plane gimbal presentation', () => {
  it('matches the ViewCube +X, -Y, +Z direction convention', () => {
    expect(centerPlaneAxisEndpoints(10)).toEqual({
      x: [10, 0, 0],
      y: [0, -10, 0],
      z: [0, 0, 10],
    });
  });

  it('keeps the full plane style compatible with the original viewer', () => {
    expect(
      centerPlaneGimbalPresentation({
        style: 'planes',
        scale: 1,
        opacity: 1,
      }),
    ).toEqual({
      planes: true,
      planeLabels: true,
      axisLabels: false,
      axes: true,
      origin: true,
      scale: 1,
      opacity: 1,
    });
  });

  it('removes visual layers for the less obtrusive styles', () => {
    const triad = centerPlaneGimbalPresentation({
      style: 'triad',
      scale: 0.8,
      opacity: 0.6,
    });
    const minimal = centerPlaneGimbalPresentation({
      style: 'minimal',
      scale: 0.5,
      opacity: 0.25,
    });

    expect(triad).toMatchObject({
      planes: false,
      planeLabels: false,
      axisLabels: true,
      origin: true,
    });
    expect(minimal).toMatchObject({
      planes: false,
      planeLabels: false,
      axisLabels: false,
      axes: true,
      origin: false,
    });
  });
});
