/**
 * @author Aidan Boissonneault
 * @file worker-runtime.test.ts
 * @purpose Tests OCCT worker build message transfer behavior.
 * @last-edited November 3, 2026
 */

import type { IRProgram, MeshData, OcctError } from '@bushscad/ir';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postBuildResult } from '../../src/worker/worker-runtime.js';
import type { OcctBridge } from '../../src/index.js';

afterEach(() => vi.unstubAllGlobals());

describe('OCCT worker build messages', () => {
  it('transfers mesh buffers with a successful build result', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('postMessage', postMessage);
    const meshes = [mesh()];
    const bridge = {
      build: vi.fn(() => ({
        ok: true as const,
        meshes,
        validations: [],
        drawings: [],
        joints: [],
      })),
    } as unknown as OcctBridge;

    postBuildResult(bridge, {
      kind: 'build',
      id: 7,
      program: emptyProgram(),
      occtTrace: true,
    });

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'build:ok', id: 7, meshes }),
      { transfer: [meshes[0].vertices.buffer, meshes[0].normals.buffer, meshes[0].indices.buffer] },
    );
    expect(bridge.build).toHaveBeenCalledWith(
      emptyProgram(),
      undefined,
      undefined,
      { trace: true },
    );
  });

  it('posts source-linked build errors without transfer buffers', () => {
    const postMessage = vi.fn();
    vi.stubGlobal('postMessage', postMessage);
    const error = {
      message: 'invalid profile',
      span: { file: 'fixture.bscd', line: 1, col: 2 },
    } satisfies OcctError;
    const bridge = {
      build: vi.fn(() => ({ ok: false as const, error })),
    } as unknown as OcctBridge;

    postBuildResult(bridge, {
      kind: 'build',
      id: 8,
      program: emptyProgram(),
    });

    expect(postMessage).toHaveBeenCalledWith({
      kind: 'build:error',
      id: 8,
      message: error.message,
      span: error.span,
    });
  });
});

/** Creates a minimal IR program for worker dispatch. */
function emptyProgram(): IRProgram {
  return { ops: [], parts: [], baseUnitMm: 1, workplane: 'XY' };
}

/** Creates a single triangle whose backing buffers can be transferred. */
function mesh(): MeshData {
  return {
    partName: 'part',
    color: '#336699',
    vertices: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    indices: new Uint32Array([0]),
  };
}
