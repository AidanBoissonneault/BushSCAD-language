/**
 * @author Aidan Boissonneault
 * @file native-parallel-booleans.test.ts
 * @purpose Tests native parallel booleans behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyNativeParallelBoolean,
  nativeParallelBooleanCapability,
} from '../../src/operations/native-parallel-booleans.js';

const SPAN = { file: 'batch.bscd', line: 4, col: 3 };

/**
 * Creates a test double for oc.
 */
function mockOc(runParallel = true) {
  const lists: unknown[][] = [];
  const builder = {
    SetArguments: vi.fn(),
    SetTools: vi.fn(),
    SetOperation: vi.fn(),
    SetNonDestructive: vi.fn(),
    SetFuzzyValue: vi.fn(),
    SetRunParallel: vi.fn(),
    RunParallel: vi.fn(() => runParallel),
    Perform: vi.fn(),
    HasErrors: vi.fn(() => false),
    Shape: vi.fn(() => ({ IsNull: () => false })),
    delete: vi.fn(),
  };
  const oc = {
    BOPAlgo_BOP_1: vi.fn(function MockBop() {
      return builder;
    }),
    TopTools_ListOfShape_1: vi.fn(function MockShapeList() {
      const items: unknown[] = [];
      lists.push(items);
      return { Append_1: vi.fn((shape) => items.push(shape)), delete: vi.fn() };
    }),
    BOPAlgo_Operation: { BOPAlgo_CUT: 2, BOPAlgo_FUSE: 1 },
  };
  return { oc, builder, lists };
}

describe('native parallel OCCT booleans', () => {
  it('uses one target, every tool, and per-builder parallel mode', () => {
    const { oc, builder, lists } = mockOc();
    const target = { id: 'target' };
    const tools = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const result = applyNativeParallelBoolean(oc, 'cut', target, tools, SPAN);

    expect(lists.at(-2)).toEqual([target]);
    expect(lists.at(-1)).toEqual(tools);
    expect(builder.SetOperation).toHaveBeenCalledWith(2);
    expect(builder.SetRunParallel).toHaveBeenCalledWith(true);
    expect(builder.RunParallel).toHaveBeenCalledOnce();
    expect(builder.Perform).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      nativeApi: 'BOPAlgo_BOP',
      runParallel: true,
      booleanBuildCount: 1,
    });
  });

  it('rejects false parallel state and incomplete capability', () => {
    const { oc } = mockOc(false);
    expect(nativeParallelBooleanCapability(oc)).toBe(true);
    expect(() =>
      applyNativeParallelBoolean(oc, 'fuse', {}, [{}, {}], SPAN),
    ).toThrow(/rejected native parallel boolean mode/);
    expect(nativeParallelBooleanCapability({})).toBe(false);
    expect(
      nativeParallelBooleanCapability({
        ...oc,
        BOPAlgo_BOP_1: function IncompleteBop() {
          return { delete: vi.fn() };
        },
      }),
    ).toBe(false);
  });

  it('uses the native parallel builder for a binary explicit fuse', () => {
    const { oc, builder, lists } = mockOc();
    applyNativeParallelBoolean(
      oc,
      'fuse',
      { id: 'left' },
      [{ id: 'right' }],
      SPAN,
    );
    expect(lists.at(-1)).toEqual([{ id: 'right' }]);
    expect(builder.SetRunParallel).toHaveBeenCalledWith(true);
    expect(builder.Perform).toHaveBeenCalledOnce();
  });
});
