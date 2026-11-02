/**
 * @author Aidan Boissonneault
 * @file trace-identity.test.ts
 * @purpose Tests trace identity behavior in the service tracing in cli package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { attachSchedulerTraceIdentity } from '../../../src/service/tracing/scheduler-trace-identity.js';
import { createVersionedTraceStream } from '../../../src/service/tracing/versioned-trace-stream.js';

describe('compiler trace identity', () => {
  it('uses actual scheduler task and worker ownership', () => {
    const event = attachSchedulerTraceIdentity(
      { kind: 'op-start', timestampMs: 10, partName: 'bracket' },
      { taskId: 7, workerId: 3, sourceIndex: 4 },
    );

    expect(event).toMatchObject({
      taskId: 'task-7',
      workerId: 'worker-3',
      sourceIndex: 4,
      partName: 'bracket',
    });
  });

  it('stamps one ordered v2 stream per service build', () => {
    const stream = createVersionedTraceStream({
      id: 12,
      kind: 'preview',
      filePath: 'C:\\workspace\\model.bscd',
      engine: 'parallel',
      occtTrace: true,
    });

    expect(stream.next({ kind: 'op-start', timestampMs: 20 })).toMatchObject({
      schemaVersion: 2,
      buildId: 'build-12',
      eventId: 'build-12:event-1',
      engine: 'parallel',
      phase: 'operation',
      state: 'running',
    });
    expect(
      stream.next({ kind: 'native-boolean-batch-rejected', timestampMs: 21 }),
    ).toMatchObject({
      eventId: 'build-12:event-2',
      phase: 'native-boolean',
      state: 'skipped',
    });
  });
});
