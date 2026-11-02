/**
 * @author Aidan Boissonneault
 * @file imported-ref-shapes.test.ts
 * @purpose Tests imported ref shapes behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { GroupBuildState } from '../../src/bridge/bridge-types.js';
import { buildImportShapeOperation } from '../../src/operations/imported-ref-shapes.js';

const SPAN = { file: 'test.bscd', line: 1, col: 1 };

/**
 * Returns the shape data required by the current operation.
 */
function shape() {
  return { IsNull: () => false };
}

/**
 * Handles state in the operations flow.
 */
function state(): GroupBuildState {
  return {
    bodyShapes: new Map(),
    bodyOwners: new Map(),
    declaredShapeNames: new Set(),
    bodyFrames: new Map(),
    labelMap: { register: vi.fn() },
    globalLabels: { register: vi.fn() },
  } as unknown as GroupBuildState;
}

describe('imported shape operations', () => {
  it('uses the STL reader for STL shape imports', () => {
    const imported = shape();
    const read = vi.fn().mockImplementation((target: object) => {
      Object.assign(target, imported);
      return true;
    });
    const oc = {
      TopoDS_Shape: vi.fn(function () {
        return shape();
      }),
      StlAPI_Reader_1: vi.fn(function () {
        return { Read: read };
      }),
    };
    const buildState = state();

    buildImportShapeOperation(oc, buildState, {
      kind: 'importShape',
      name: 'base',
      fsPath: '/shapes/imported/base.stl',
      format: 'stl',
      span: SPAN,
    });

    expect(oc.StlAPI_Reader_1).toHaveBeenCalled();
    expect(read).toHaveBeenCalledWith(
      buildState.bodyShapes.get('base'),
      '/shapes/imported/base.stl',
    );
    expect(buildState.declaredShapeNames.has('base')).toBe(true);
  });
});
