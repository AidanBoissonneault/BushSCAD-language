/**
 * @author Aidan Boissonneault
 * @file simulated-worker-pool.ts
 * @purpose Provides simulated worker pool behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { validateSchedulerCapacity } from './scheduler-capacity.js';
import type {
  SchedulerCapacity,
  SchedulerWorkerPool,
  SchedulerWorkerSnapshot,
  SchedulerWorkerState,
} from './scheduler-types.js';

/**
 * Type used for options for simulated worker pool.
 */
export type SimulatedWorkerPoolOptions = Readonly<{
  maximumWorkerCount: number;
  memoryPerWorkerMiB: number;
  memoryBudgetMiB: number;
}>;

/**
 * Mutable worker, including identifier, current state, and task id.
 */
type MutableWorker = {
  id: string;
  state: SchedulerWorkerState;
  taskId?: string;
};

/** Models persistent warm worker lifecycle without starting an OCCT runtime. */
export class SimulatedWorkerPool implements SchedulerWorkerPool {
  private readonly workers: MutableWorker[] = [];
  private nextWorkerNumber = 1;
  requestedWorkerCount = 0;

  /**
   * Initializes the `SimulatedWorkerPool` instance with the values supplied by its caller.
   */
  constructor(private readonly options: SimulatedWorkerPoolOptions) {}

  /**
   * Handles reconcile in the pipeline parallel compilation flow.
   */
  reconcile(requestedWorkerCount: number): SchedulerCapacity {
    const validation = validateSchedulerCapacity({
      requestedWorkerCount,
      healthyWorkerCount: 0,
      ...this.options,
    });
    if (!validation.ok) return validation;
    this.requestedWorkerCount = requestedWorkerCount;
    const retained = this.workers.filter((worker) =>
      ['warming', 'ready', 'busy'].includes(worker.state),
    );
    for (const worker of [...retained]
      .sort((left, right) => left.id.localeCompare(right.id))
      .slice(requestedWorkerCount)) {
      if (worker.state === 'busy') worker.state = 'stopping';
      else worker.state = 'stopped';
    }
    const activeCount = this.workers.filter((worker) =>
      ['warming', 'ready', 'busy'].includes(worker.state),
    ).length;
    for (let index = activeCount; index < requestedWorkerCount; index++) {
      this.workers.push({
        id: `worker-${String(this.nextWorkerNumber++).padStart(3, '0')}`,
        state: 'warming',
      });
    }
    return this.capacity();
  }

  /**
   * Updates state to record ready.
   */
  markReady(workerId: string): void {
    const worker = this.requireWorker(workerId);
    if (worker.state !== 'warming')
      throw new Error(`Worker '${workerId}' is not warming.`);
    worker.state = 'ready';
  }

  /**
   * Handles acquire in the pipeline parallel compilation flow.
   */
  acquire(taskId: string): string | undefined {
    const worker = this.workers
      .filter((candidate) => candidate.state === 'ready')
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!worker) return undefined;
    worker.state = 'busy';
    worker.taskId = taskId;
    return worker.id;
  }

  /**
   * Handles release in the pipeline parallel compilation flow.
   */
  release(workerId: string): void {
    const worker = this.requireWorker(workerId);
    if (worker.state === 'stopping') worker.state = 'stopped';
    else if (worker.state === 'busy') worker.state = 'ready';
    else throw new Error(`Worker '${workerId}' is not leased.`);
    delete worker.taskId;
  }

  /**
   * Handles fail in the pipeline parallel compilation flow.
   */
  fail(workerId: string): void {
    const worker = this.requireWorker(workerId);
    worker.state = 'failed';
    delete worker.taskId;
  }

  /**
   * Handles shutdown in the pipeline parallel compilation flow.
   */
  shutdown(): void {
    this.requestedWorkerCount = 0;
    for (const worker of this.workers) {
      if (worker.state === 'busy') worker.state = 'stopping';
      else if (!['failed', 'stopped'].includes(worker.state))
        worker.state = 'stopped';
    }
  }

  /**
   * Handles capacity in the pipeline parallel compilation flow.
   */
  capacity(): SchedulerCapacity {
    const healthyWorkerCount = this.workers.filter((worker) =>
      ['ready', 'busy'].includes(worker.state),
    ).length;
    if (this.requestedWorkerCount === 0)
      return Object.freeze({
        ok: true,
        effectiveWorkerCount: 0,
        memoryBoundWorkerCount: Math.floor(
          this.options.memoryBudgetMiB / this.options.memoryPerWorkerMiB,
        ),
        issues: Object.freeze([]),
      });
    return validateSchedulerCapacity({
      requestedWorkerCount: this.requestedWorkerCount,
      healthyWorkerCount,
      ...this.options,
    });
  }

  /**
   * Handles snapshot in the pipeline parallel compilation flow.
   */
  snapshot(): readonly SchedulerWorkerSnapshot[] {
    return Object.freeze(
      this.workers
        .map((worker) => Object.freeze({ ...worker }))
        .sort((left, right) => left.id.localeCompare(right.id)),
    );
  }

  /**
   * Handles require worker in the pipeline parallel compilation flow.
   */
  private requireWorker(workerId: string): MutableWorker {
    const worker = this.workers.find((candidate) => candidate.id === workerId);
    if (!worker) throw new Error(`Unknown worker '${workerId}'.`);
    return worker;
  }
}
