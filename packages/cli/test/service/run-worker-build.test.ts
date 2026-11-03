/**
 * @author Aidan Boissonneault
 * @file run-worker-build.test.ts
 * @purpose Tests isolated parallel worker build result messages.
 * @last-edited November 3, 2026
 */

import type { MeshData } from '@bushscad/ir';
import { describe, expect, it, vi } from 'vitest';
import type { ParallelBuildTask, ParallelWorkerMessage } from '../../src/service/parallel/worker-protocol.js';
import { runBuild } from '../../src/service/parallel/run-worker.js';

describe('parallel worker build messages', () => {
  it('posts task output and forwards build trace callbacks', () => {
    const meshes = [mesh()];
    const traceEvent = { kind: 'build-start' as const };
    const bridge = {
      build: vi.fn((_program, _assets, _drawingProgram, options) => {
        options?.onTraceEvent?.(traceEvent);
        return {
          ok: true as const,
          meshes,
          drawings: [],
          validations: [],
          joints: [],
          occtTraceEvents: [],
        };
      }),
    } as never;
    const sendMessage = vi.fn<(message: ParallelWorkerMessage) => void>();

    runBuild(bridge, task(), sendMessage);

    expect(sendMessage).toHaveBeenCalledWith({
      kind: 'trace',
      taskId: 11,
      event: traceEvent,
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'result',
        output: expect.objectContaining({
          taskId: 11,
          partName: 'housing',
          sourceIndex: 2,
          meshes,
          traceEvents: [],
        }),
      }),
    );
  });

  it('serializes source-linked build failures', () => {
    const error = {
      message: 'bad profile',
      span: { file: 'model.bscd', line: 4, col: 5 },
    };
    const bridge = { build: vi.fn(() => ({ ok: false as const, error })) } as never;
    const sendMessage = vi.fn<(message: ParallelWorkerMessage) => void>();

    runBuild(bridge, task(), sendMessage);

    expect(sendMessage).toHaveBeenCalledWith({
      kind: 'error',
      taskId: 11,
      message: error.message,
      span: error.span,
    });
  });
});

/** Creates a minimal parallel build task with trace enabled. */
function task(): ParallelBuildTask {
  return {
    taskId: 11,
    partName: 'housing',
    sourceIndex: 2,
    autoColorOffset: 0,
    program: { ops: [], parts: [], baseUnitMm: 1, workplane: 'XY' },
    assets: { fonts: [], shapes: [] },
    trace: true,
  };
}

/** Creates a small mesh payload for the successful worker response. */
function mesh(): MeshData {
  return {
    partName: 'housing',
    color: '#336699',
    vertices: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    indices: new Uint32Array([0]),
  };
}
