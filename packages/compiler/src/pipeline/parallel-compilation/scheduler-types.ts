/**
 * @author Aidan Boissonneault
 * @file scheduler-types.ts
 * @purpose Provides scheduler types behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompilationGraph,
  CompilationGraphEdge,
  CompilationGraphNode,
  SourceSpan,
} from '@bushscad/ir';

/**
 * Accepted values for state for scheduler worker are 'warming', 'ready', 'busy', 'stopping',
 * 'stopped', and 'failed'.
 */
export type SchedulerWorkerState =
  | 'warming'
  | 'ready'
  | 'busy'
  | 'stopping'
  | 'stopped'
  | 'failed';

/**
 * Type used for snapshot of scheduler worker.
 */
export type SchedulerWorkerSnapshot = Readonly<{
  id: string;
  state: SchedulerWorkerState;
  taskId?: string;
}>;

/**
 * Type used for configuration for scheduler capacity.
 */
export type SchedulerCapacityConfiguration = Readonly<{
  requestedWorkerCount: number;
  healthyWorkerCount: number;
  maximumWorkerCount: number;
  memoryPerWorkerMiB: number;
  memoryBudgetMiB: number;
}>;

/**
 * Type used for scheduler capacity.
 */
export type SchedulerCapacity = Readonly<{
  ok: boolean;
  effectiveWorkerCount: number;
  memoryBoundWorkerCount: number;
  issues: readonly string[];
}>;

/**
 * Scheduler worker pool, including requested worker count, capacity, acquire, release, and
 * snapshot.
 */
export interface SchedulerWorkerPool {
  readonly requestedWorkerCount: number;
  capacity(): SchedulerCapacity;
  acquire(taskId: string): string | undefined;
  release(workerId: string): void;
  snapshot(): readonly SchedulerWorkerSnapshot[];
}

/**
 * Type used for scheduler graph extension.
 */
export type SchedulerGraphExtension = Readonly<{
  nodes: readonly CompilationGraphNode[];
  edges: readonly CompilationGraphEdge[];
}>;

/**
 * Scheduler task outcome accepts Readonly<{ kind: 'completed'; artifact?: unknown }, Readonly<{
 * kind: 'failed'; message: string }>, and Readonly<{ kind: 'continuation'; extension: Schedu.
 */
export type SchedulerTaskOutcome =
  | Readonly<{ kind: 'completed'; artifact?: unknown }>
  | Readonly<{ kind: 'failed'; message: string }>
  | Readonly<{
      kind: 'continuation';
      extension: SchedulerGraphExtension;
    }>;

/**
 * Type used for context for scheduler task.
 */
export type SchedulerTaskContext = Readonly<{
  node: CompilationGraphNode;
  attempt: number;
  workerId?: string;
  signal?: AbortSignal;
}>;

/**
 * Defines the `SchedulerTaskRunner` callback contract used by the pipeline parallel compilation layer.
 */
export type SchedulerTaskRunner = (
  context: SchedulerTaskContext,
) => SchedulerTaskOutcome | Promise<SchedulerTaskOutcome>;

/**
 * Accepted values for status of scheduler node are 'pending', 'running', 'completed', 'failed',
 * and 'cancelled'.
 */
export type SchedulerNodeStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Type used for result of scheduler node.
 */
export type SchedulerNodeResult = Readonly<{
  nodeId: string;
  status: SchedulerNodeStatus;
  attempts: number;
}>;

/**
 * Type used for scheduler artifact.
 */
export type SchedulerArtifact = Readonly<{
  nodeId: string;
  value: unknown;
  cacheHit: boolean;
}>;

/**
 * Accepted values for scheduler error code are 'capacity', 'invalid-graph',
 * 'invalid-continuation', 'task-failed', and 'stalled'.
 */
export type SchedulerErrorCode =
  | 'capacity'
  | 'invalid-graph'
  | 'invalid-continuation'
  | 'task-failed'
  | 'stalled';

/**
 * Type used for scheduler error.
 */
export type SchedulerError = Readonly<{
  code: SchedulerErrorCode;
  message: string;
  nodeId?: string;
  span: SourceSpan;
}>;

/**
 * Type used for measurements for scheduler.
 */
export type SchedulerMetrics = Readonly<{
  totalNodeCount: number;
  dispatchedTaskCount: number;
  completedNodeCount: number;
  failedNodeCount: number;
  cancelledNodeCount: number;
  cacheHitCount: number;
  continuationCount: number;
  maximumGeometryConcurrency: number;
  maximumMetadataConcurrency: number;
  effectiveWorkerCount: number;
}>;

/**
 * Type used for options for scheduler simulation.
 */
export type SchedulerSimulationOptions = Readonly<{
  workerPool: SchedulerWorkerPool;
  metadataConcurrency?: number;
  activeNodeIds?: ReadonlySet<string>;
  cachedArtifacts?: ReadonlyMap<string, unknown>;
  signal?: AbortSignal;
}>;

/**
 * Type used for result of scheduler simulation.
 */
export type SchedulerSimulationResult = Readonly<{
  ok: boolean;
  cancelled: boolean;
  graph: CompilationGraph;
  nodes: readonly SchedulerNodeResult[];
  artifacts: readonly SchedulerArtifact[];
  errors: readonly SchedulerError[];
  metrics: SchedulerMetrics;
  workerSnapshot: readonly SchedulerWorkerSnapshot[];
}>;
