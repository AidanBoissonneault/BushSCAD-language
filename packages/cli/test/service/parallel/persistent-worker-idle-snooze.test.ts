import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { ChildProcess } from 'node:child_process';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const forkMock = vi.hoisted(() => vi.fn());
vi.mock('node:child_process', () => ({ fork: forkMock }));

import { PersistentOcctWorkerPool } from '../../../src/service/parallel/persistent-worker-pool.js';

type FakeWorker = EventEmitter & {
  connected: boolean;
  killed: boolean;
  stderr: PassThrough;
  send: ChildProcess['send'];
  kill: ChildProcess['kill'];
};

let workers: FakeWorker[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  workers = [];
  forkMock.mockReset().mockImplementation(() => {
    const worker = new EventEmitter() as FakeWorker;
    Object.assign(worker, {
      connected: true,
      killed: false,
      stderr: new PassThrough(),
      send: vi.fn((message: { kind?: string }) => {
        if (message.kind === 'shutdown') worker.kill();
      }),
      kill: vi.fn(() => {
        worker.connected = false;
        worker.killed = true;
        queueMicrotask(() => worker.emit('exit', 0, null));
        return true;
      }),
    });
    workers.push(worker);
    queueMicrotask(() =>
      worker.emit('message', {
        kind: 'ready',
        startupMs: 1,
        workerRssBytes: 10,
      }),
    );
    return worker;
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('warm worker idle snoozing', () => {
  it('stops idle workers after the timeout and warms them on demand', async () => {
    const pool = new PersistentOcctWorkerPool(1, undefined, 'worker.js', 100);
    pool.warm();
    await Promise.resolve();
    expect(pool.snapshot().state).toBe('ready');

    await vi.advanceTimersByTimeAsync(99);
    expect(pool.snapshot().state).toBe('ready');
    await vi.advanceTimersByTimeAsync(1);
    expect(pool.snapshot().state).toBe('stopped');
    expect(workers[0]?.kill).toHaveBeenCalledOnce();

    pool.warm();
    await Promise.resolve();
    expect(forkMock).toHaveBeenCalledTimes(2);
    expect(pool.snapshot().state).toBe('ready');
    pool.dispose();
  });

  it('keeps warm workers when the timeout is disabled', async () => {
    const pool = new PersistentOcctWorkerPool(1, undefined, 'worker.js', 0);
    pool.warm();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(pool.snapshot().state).toBe('ready');
    expect(workers[0]?.kill).not.toHaveBeenCalled();
    pool.dispose();
  });
});
