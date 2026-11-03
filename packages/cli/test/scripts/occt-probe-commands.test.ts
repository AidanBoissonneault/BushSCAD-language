/**
 * @author Aidan Boissonneault
 * @file occt-probe-commands.test.ts
 * @purpose Tests command execution and geometry summaries for OCCT probes.
 * @last-edited November 3, 2026
 */

import type { MeshData } from '@bushscad/ir';
import { describe, expect, it, vi } from 'vitest';
import {
  executeProbeCommand,
  handleProbeCommand,
  serializationApis,
  summarizeProbeMeshes,
} from '../../../../scripts/parallel-compilation/occt-probe-commands.js';

describe('OCCT probe commands', () => {
  it('summarizes mesh counts, triangles, and three-dimensional bounds', () => {
    expect(summarizeProbeMeshes([mesh()])).toEqual({
      meshCount: 1,
      triangleCount: 1,
      bounds: { min: [-2, 0, -1], max: [4, 3, 5] },
    });
    expect(summarizeProbeMeshes([]).bounds.min).toEqual([
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ]);
  });

  it('lists BRep serialization APIs in a stable order', () => {
    expect(
      serializationApis({
        oc: {
          BRepTools_Read: {},
          BinTools_Write: {},
          ShapeTool: {},
          BRepTools: { Save: () => undefined, Read: () => undefined },
        },
      }),
    ).toEqual([
      'BRepTools',
      'BRepTools.Read',
      'BRepTools.Save',
      'BRepTools_Read',
      'BinTools_Write',
    ]);
    expect(serializationApis({})).toEqual([]);
  });

  it('reports shutdown and memory commands without requiring OCCT methods', () => {
    const bridge = {} as Parameters<typeof executeProbeCommand>[0];
    expect(executeProbeCommand(bridge, { kind: 'shutdown', requestId: 1 })).toEqual({
      shutdown: true,
    });
    expect(executeProbeCommand(bridge, { kind: 'memory', requestId: 2 })).toEqual(
      {},
    );
  });

  it('builds the probe cuboid and summarizes the returned geometry', () => {
    const build = vi.fn(() => ({ ok: true as const, meshes: [mesh()] }));
    const bridge = { build } as unknown as Parameters<
      typeof executeProbeCommand
    >[0];

    const result = executeProbeCommand(bridge, {
      kind: 'build-cuboid',
      requestId: 3,
    });

    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({ parts: ['probe'] }),
      { fonts: [], shapes: [] },
    );
    expect(result.extra?.geometry).toEqual(summarizeProbeMeshes([mesh()]));
  });

  it('turns command errors into request-scoped worker messages', async () => {
    const errorMessage = 'build failed';
    const bridge = {
      build: vi.fn(() => ({
        ok: false as const,
        error: { message: errorMessage },
      })),
    } as unknown as Parameters<typeof executeProbeCommand>[0];
    const send = vi.fn();
    const sendResult = vi.fn();

    await handleProbeCommand(
      bridge,
      { kind: 'build-cuboid', requestId: 4 },
      { send, sendResult, close: vi.fn() },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'error',
        requestId: 4,
        message: expect.stringContaining(errorMessage),
      }),
    );
    expect(sendResult).not.toHaveBeenCalled();
  });
});

/** Creates mesh bounds with one triangle for deterministic summary tests. */
function mesh(): MeshData {
  return {
    partName: 'part',
    color: '#000000',
    vertices: new Float32Array([-2, 0, -1, 4, 3, 5, 0, 1, 2]),
    normals: new Float32Array(9),
    indices: new Uint32Array([0, 1, 2]),
  };
}
