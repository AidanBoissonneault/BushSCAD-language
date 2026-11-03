/**
 * @author Aidan Boissonneault
 * @file persistent-worker-pool.ts
 * @purpose Provides persistent worker pool behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import { fork, type ChildProcess } from 'node:child_process';
import type { OcctTraceEvent } from '@bushscad/ir';
import type {
  ParallelBuildOutput,
  ParallelBuildTask,
  ParallelComponentOutput,
  ParallelComponentTask,
  ParallelExportOutput,
  ParallelExportTask,
  ParallelPoolStatus,
  ParallelWorkerMessage,
} from './worker-protocol.js';
import {
  PoolExecutionRecorder,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';
import { type PoolTaskOutput, type WorkerSlot } from './pool-worker-slot.js';
import { createPoolStatus } from './pool-status.js';
import { forwardSchedulerTrace } from '../tracing/scheduler-trace-identity.js';
import { sourceMappedWorkerError } from './worker-errors.js';

/** Owns persistent child processes that each initialize and retain one OCCT. */
export class PersistentOcctWorkerPool {
  private readonly slots: WorkerSlot[] = [];
  private disposed = false;
  private nextSlotId = 1;
  private nextTaskId = 1;
  private peakAggregateWorkerRssBytes = 0;
  private execution: PoolExecutionMetrics = new PoolExecutionRecorder().finish(
    0,
  );

  /**
   * Initializes the `PersistentOcctWorkerPool` instance with the values supplied by its caller.
   */
  constructor(
    private readonly desiredWorkers: number,
    private readonly onStatus?: (status: ParallelPoolStatus) => void,
    private readonly workerEntryPath = process.argv[1],
  ) {}

  /** Starts every configured worker without waiting for the first compile. */
  warm(): void {
    if (this.disposed || this.slots.length > 0) return;
    for (let index = 0; index < this.desiredWorkers; index++) this.spawnSlot();
    this.publishStatus();
  }

  /** Runs source-ordered tasks on the healthy ready subset. */
  async build(
    tasks: readonly Omit<ParallelBuildTask, 'taskId'>[],
    onTrace?: (event: OcctTraceEvent) => void,
  ): Promise<ParallelBuildOutput[]> {
    return this.runAcrossReadySlots(tasks, (slot, task) =>
      this.runBuildTask(slot, task, onTrace),
    );
  }

  /** Builds transferable component artifacts across every healthy ready worker. */
  async prepareComponents(
    tasks: readonly Omit<ParallelComponentTask, 'taskId'>[],
    onTrace?: (event: OcctTraceEvent) => void,
  ): Promise<ParallelComponentOutput[]> {
    return this.runAcrossReadySlots(tasks, (slot, task) =>
      this.runComponentTask(slot, task, onTrace),
    );
  }

  /** Executes classic deterministic export inside one warm worker. */
  async export(
    task: Omit<ParallelExportTask, 'taskId'>,
  ): Promise<ParallelExportOutput> {
    const [slot] = await this.waitForReadyWorkers();
    if (!slot) throw new Error('No parallel OCCT worker is ready.');
    const taskId = this.nextTaskId++;
    slot.state = 'busy';
    this.publishStatus();
    const recorder = new PoolExecutionRecorder();
    const dispatchedAt = recorder.dispatch();
    try {
      const output = await new Promise<ParallelExportOutput>(
        (resolve, reject) => {
          slot.pending = {
            taskId,
            resolve: (value) => resolve(value as ParallelExportOutput),
            reject,
          };
          slot.process.send?.({ kind: 'export', task: { ...task, taskId } });
        },
      );
      recorder.complete(dispatchedAt, output);
      return output;
    } finally {
      this.execution = recorder.finish(1);
    }
  }

  /** Returns measurements for the most recently completed scheduling phase. */
  executionMetrics(): PoolExecutionMetrics {
    return { ...this.execution };
  }

  /**
   * Handles snapshot in the service parallel flow.
   */
  snapshot(): ParallelPoolStatus {
    return createPoolStatus(
      this.slots,
      this.disposed,
      this.desiredWorkers,
      this.peakAggregateWorkerRssBytes,
    );
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots) {
      if (slot.process.connected) {
        try {
          slot.process.send?.({ kind: 'shutdown' }, () => undefined);
        } catch {
          // A crashed worker is already stopped; its replacement is handled too.
        }
      }
      if (!slot.process.killed) slot.process.kill();
      slot.pending?.reject(new Error('Parallel OCCT worker pool stopped.'));
    }
    this.slots.length = 0;
    this.publishStatus();
  }

  /**
   * Handles spawn slot in the service parallel flow.
   */
  private spawnSlot(): void {
    const workerProcess: ChildProcess = fork(
      this.workerEntryPath,
      ['--parallel-occt-worker'],
      {
        env: { ...globalThis.process.env, ELECTRON_RUN_AS_NODE: '1' },
        silent: true,
        serialization: 'advanced',
      },
    );
    const slot: WorkerSlot = {
      id: this.nextSlotId++,
      process: workerProcess,
      state: 'warming',
      startupMs: 0,
      rssBytes: 0,
    };
    this.slots.push(slot);
    workerProcess.on('message', (message: ParallelWorkerMessage) =>
      this.onWorkerMessage(slot, message),
    );
    workerProcess.stderr?.on('data', (chunk: Buffer) =>
      globalThis.process.stderr.write(
        `[BushSCAD parallel worker] ${String(chunk)}`,
      ),
    );
    workerProcess.on('exit', () => this.onWorkerExit(slot));
  }

  /**
   * Handles the worker message event.
   */
  private onWorkerMessage(
    slot: WorkerSlot,
    message: ParallelWorkerMessage,
  ): void {
    switch (message.kind) {
      case 'ready':
        slot.startupMs = message.startupMs;
        this.updateSlotMemory(slot, message.workerRssBytes);
        slot.state = 'ready';
        break;
      case 'trace':
        forwardSchedulerTrace(slot, message.taskId, message.event);
        return;
      case 'result':
      case 'component-result':
      case 'export-result':
        this.updateSlotMemory(slot, message.output.workerRssBytes);
        this.finishTask(slot, () => slot.pending?.resolve(message.output));
        break;
      case 'error':
        this.finishTask(slot, () =>
          slot.pending?.reject(
            sourceMappedWorkerError(message.message, message.span),
          ),
        );
    }
    this.publishStatus();
  }

  /**
   * Handles the worker exit event.
   */
  private onWorkerExit(slot: WorkerSlot): void {
    slot.pending?.reject(new Error(`Parallel OCCT worker ${slot.id} exited.`));
    slot.pending = undefined;
    slot.state = 'failed';
    this.publishStatus();
    if (!this.disposed) this.spawnSlot();
  }

  /**
   * Completes task and records its final state.
   */
  private finishTask(slot: WorkerSlot, settle: () => void): void {
    settle();
    slot.pending = undefined;
    slot.state = 'ready';
  }

  /**
   * Waits for for ready workers to reach the requested state.
   */
  private async waitForReadyWorkers(): Promise<WorkerSlot[]> {
    this.warm();
    while (!this.disposed) {
      const ready = this.slots.filter((slot) => slot.state === 'ready');
      if (ready.length > 0) return ready;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return [];
  }

  /**
   * Runs build task and returns its result.
   */
  private runBuildTask(
    slot: WorkerSlot,
    task: Omit<ParallelBuildTask, 'taskId'>,
    onTrace?: (event: OcctTraceEvent) => void,
  ): Promise<ParallelBuildOutput> {
    return this.dispatchTask(slot, task.sourceIndex, onTrace, (taskId) => {
      slot.process.send?.({ kind: 'build', task: { ...task, taskId } });
    });
  }

  /**
   * Runs component task and returns its result.
   */
  private runComponentTask(
    slot: WorkerSlot,
    task: Omit<ParallelComponentTask, 'taskId'>,
    onTrace?: (event: OcctTraceEvent) => void,
  ): Promise<ParallelComponentOutput> {
    return this.dispatchTask(slot, task.sourceIndex, onTrace, (taskId) => {
      slot.process.send?.({
        kind: 'prepare-component',
        task: { ...task, taskId },
      });
    });
  }

  /**
   * Registers shared pending-task state before sending work to a worker.
   *
   * Why: build and component requests share task identity, status, and trace
   * handling, so dispatch must establish that lifecycle in one place.
   */
  private dispatchTask<TOutput extends PoolTaskOutput>(
    slot: WorkerSlot,
    sourceIndex: number,
    onTrace: ((event: OcctTraceEvent) => void) | undefined,
    send: (taskId: number) => void,
  ): Promise<TOutput> {
    const taskId = this.nextTaskId++;
    slot.state = 'busy';
    this.publishStatus();
    return new Promise((resolve, reject) => {
      slot.pending = {
        taskId,
        sourceIndex,
        resolve: (output) => resolve(output as TOutput),
        reject,
        onTrace,
      };
      send(taskId);
    });
  }

  /** Preserves task order while sharing work over the current healthy subset. */
  private async runAcrossReadySlots<TTask, TOutput extends PoolTaskOutput>(
    tasks: readonly TTask[],
    runTask: (slot: WorkerSlot, task: TTask) => Promise<TOutput>,
  ): Promise<TOutput[]> {
    const slots = await this.waitForReadyWorkers();
    if (slots.length === 0)
      throw new Error('No parallel OCCT worker is ready.');
    const outputs: TOutput[] = [];
    const recorder = new PoolExecutionRecorder();
    let nextIndex = 0;
    /**
     * Runs slot and returns its result.
     */
    const runSlot = async (slot: WorkerSlot): Promise<void> => {
      while (nextIndex < tasks.length) {
        const index = nextIndex++;
        const dispatchedAt = recorder.dispatch();
        const output = await runTask(slot, tasks[index]);
        recorder.complete(dispatchedAt, output);
        outputs[index] = output;
      }
    };
    try {
      await Promise.all(slots.map(runSlot));
      return outputs;
    } finally {
      this.execution = recorder.finish(slots.length);
    }
  }

  /**
   * Updates slot memory while preserving unrelated state.
   */
  private updateSlotMemory(slot: WorkerSlot, rssBytes: number): void {
    slot.rssBytes = rssBytes;
    this.peakAggregateWorkerRssBytes = Math.max(
      this.peakAggregateWorkerRssBytes,
      this.aggregateWorkerRssBytes(),
    );
  }

  /**
   * Handles aggregate worker rss bytes in the service parallel flow.
   */
  private aggregateWorkerRssBytes(): number {
    return this.slots.reduce((total, slot) => total + slot.rssBytes, 0);
  }

  /**
   * Handles publish status in the service parallel flow.
   */
  private publishStatus(): void {
    this.onStatus?.(this.snapshot());
  }
}
