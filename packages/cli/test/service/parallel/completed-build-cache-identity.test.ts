import { describe, expect, it } from 'vitest';
import { completedBuildCacheIdentity } from '../../../src/service/parallel/completed-build-cache-identity.js';
import type { ParallelBuildTask } from '../../../src/service/parallel/worker-protocol.js';

describe('completedBuildCacheIdentity', () => {
  it('ignores scheduler identity but includes output-affecting build inputs', () => {
    const task = sampleTask();
    const first = completedBuildCacheIdentity(task);
    const schedulerOnlyChange = completedBuildCacheIdentity({
      ...task,
      sourceIndex: task.sourceIndex + 4,
      trace: !task.trace,
    });

    expect(schedulerOnlyChange).toEqual(first);
    expect(
      completedBuildCacheIdentity({
        ...task,
        autoColorOffset: task.autoColorOffset + 1,
      }).digest,
    ).not.toBe(first.digest);
    expect(
      completedBuildCacheIdentity({
        ...task,
        assets: {
          ...task.assets,
          fonts: [
            {
              ...task.assets.fonts[0]!,
              data: new Uint8Array([1, 2, 4]),
            },
          ],
        },
      }).digest,
    ).not.toBe(first.digest);
  });
});

/** Supplies a worker task with binary assets for key-sensitivity checks. */
function sampleTask(): Omit<ParallelBuildTask, 'taskId'> {
  return {
    partName: 'base_plate',
    sourceIndex: 0,
    autoColorOffset: 0,
    program: {
      ops: [],
      parts: ['base_plate'],
      baseUnitMm: 1,
      interaction: {
        version: 1,
        entrypoint: 'model.bscd',
        entities: [],
        effects: [],
        references: [],
        topology: [],
      },
    },
    assets: {
      fonts: [
        {
          name: 'test',
          sourcePath: '/fonts/test.ttf',
          fsPath: '/fonts/test.ttf',
          data: new Uint8Array([1, 2, 3]),
        },
      ],
      shapes: [],
    },
    trace: false,
  };
}
