/**
 * @author Aidan Boissonneault
 * @file surface-bound-sketches.test.ts
 * @purpose Tests surface bound sketches behavior in the surfaces in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import { clipSurfaceBoundSketchFace } from '../../src/surfaces/surface-bound-sketches.js';
import type { GroupBuildState } from '../../src/bridge/bridge-types.js';

const SPAN = { file: 'test.bscd', line: 1, col: 1 };

describe('surface-bound sketch clipping', () => {
  it('intersects a placed sketch face with its bound target face', () => {
    const placedFace = { id: 'placed' };
    const targetFace = { id: 'target' };
    const clippedFace = { id: 'clipped' };
    const common = {
      Build: vi.fn(),
      IsDone: vi.fn(() => true),
      Shape: vi.fn(() => clippedFace),
      delete: vi.fn(),
    };
    const Common = vi.fn(function BRepAlgoApiCommon() {
      return common;
    });
    const oc = { BRepAlgoAPI_Common_3: Common };
    const state = {
      surfaceBoundSketches: new Map([['detail', { faceRef: 'base.top' }]]),
      bodyOwners: new Map(),
      labelMap: {
        getFaceHandles: vi.fn(() => [targetFace]),
      },
    } as unknown as GroupBuildState;

    const result = clipSurfaceBoundSketchFace(
      oc,
      state,
      'detail',
      placedFace,
      SPAN,
    );

    expect(result).toBe(clippedFace);
    expect(Common).toHaveBeenCalledWith(placedFace, targetFace);
    expect(common.Build).toHaveBeenCalled();
    expect(common.Shape).toHaveBeenCalled();
    expect(common.delete).toHaveBeenCalled();
  });
});
