/**
 * @author Aidan Boissonneault
 * @file joint-transforms.test.ts
 * @purpose Tests joint transforms behavior in the parts in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { ResolvedJointData } from '@bushscad/ir';
import {
  clampJointValue,
  jointPartTransforms,
} from '../../src/parts/joint-transforms.js';

const slider: ResolvedJointData = {
  name: 'slide',
  jointType: 'slider',
  limitMin: 0,
  limitMax: 20,
  defaultValue: 5,
  origin: [0, 0, 0],
  axis: [1, 0, 0],
  movingPartName: 'carriage',
  staticPartName: 'base',
};

describe('joint preview transforms', () => {
  it('clamps values and translates the moving part along its axis', () => {
    expect(clampJointValue(slider, 30)).toBe(20);
    const transforms = jointPartTransforms([slider], new Map([['slide', 12]]));
    expect(transforms.get('carriage')?.position.toArray()).toEqual([12, 0, 0]);
  });
});
