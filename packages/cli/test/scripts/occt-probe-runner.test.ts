/**
 * @author Aidan Boissonneault
 * @file occt-probe-runner.test.ts
 * @purpose Tests the OCCT probe sequence and generated report payload.
 * @last-edited November 3, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { ProbeMessage } from '../../../../scripts/parallel-compilation/occt-probe-protocol.js';
import {
  runProbe,
  type ProbeWorkerHandle,
} from '../../../../scripts/parallel-compilation/occt-probe-runner.js';

describe('OCCT probe runner', () => {
  it('runs cold/warm builds, memory checks, transfers, and worker cleanup', async () => {
    const handles: ProbeWorkerHandle[] = [];
    const createWorker = vi.fn((_mode, workerId) => {
      const handle = fakeWorker(workerId);
      handles.push(handle);
      return handle;
    });
    const writeJsonReport = vi.fn().mockResolvedValue(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await runProbe(
      [
        '--mode',
        'thread',
        '--workers',
        '2',
        '--idle-ms',
        '0',
        '--out',
        'probe.json',
      ],
      {
        createWorker,
        writeJsonReport,
        sleep,
      } as unknown as NonNullable<Parameters<typeof runProbe>[1]>,
    );

    expect(createWorker).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(0);
    expect(handles.every((handle) => handle)).toBe(true);
    expect(writeJsonReport).toHaveBeenCalledWith(
      expect.stringContaining('probe.json'),
      expect.objectContaining({
        mode: 'thread',
        workerCount: 2,
        transfer: expect.objectContaining({ stepBytes: 4 }),
        nativeBrepTransfer: expect.objectContaining({ brepBytes: 4 }),
      }),
      expect.objectContaining({
        transfer: expect.objectContaining({
          exportResult: expect.objectContaining({
            dataBase64: '(omitted 4 bytes)',
          }),
        }),
      }),
    );
  });
});

/** Creates an in-memory probe worker that responds to every protocol request. */
function fakeWorker(workerId: number): ProbeWorkerHandle {
  const listeners: Array<(message: ProbeMessage) => void> = [];
  const emit = (message: ProbeMessage): void => {
    for (const listener of listeners) listener(message);
  };
  return {
    send(command) {
      const dataBase64 =
        command.kind === 'export-cuboid'
          ? 'U1RFUA=='
          : command.kind === 'export-brep'
            ? 'QlJFUA=='
            : undefined;
      emit({
        kind: 'result',
        requestId: command.requestId,
        elapsedMs: 1,
        rssBytes: 32,
        heapUsedBytes: 16,
        ...(dataBase64 ? { dataBase64 } : {}),
      });
    },
    onMessage(listener) {
      listeners.push(listener);
      queueMicrotask(() =>
        emit({
          kind: 'ready',
          workerId,
          initializationMs: 1,
          rssBytes: 32,
          heapUsedBytes: 16,
          serializationApis: [],
        }),
      );
    },
    terminate: async () => undefined,
  };
}
