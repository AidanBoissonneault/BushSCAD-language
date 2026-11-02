/**
 * @author Aidan Boissonneault
 * @file run-worker.ts
 * @purpose Provides run worker behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import { getBridge } from '@bushscad/compiler/node';
import type { OcctTraceEvent, PreparedComponentArtifact } from '@bushscad/ir';
import {
  sourceMappedWorkerError,
  sourceSpanFrom,
  workerErrorMessage,
} from './worker-errors.js';
import type {
  ParallelWorkerTelemetry,
  ParallelWorkerMessage,
  ParallelWorkerRequest,
} from './worker-protocol.js';

/** Runs one isolated, persistent OCCT owner process. */
export async function runParallelOcctWorker(): Promise<void> {
  const startedAt = Date.now();
  const bridge = await getBridge();
  send({
    kind: 'ready',
    startupMs: Date.now() - startedAt,
    workerRssBytes: process.memoryUsage().rss,
  });

  process.on('message', (message: ParallelWorkerRequest) =>
    handleWorkerRequest(bridge, message),
  );
  process.on('disconnect', () => process.exit(0));
}

/** Dispatches protocol messages while preserving one exclusive OCCT owner. */
function handleWorkerRequest(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  message: ParallelWorkerRequest,
): void {
  if (message.kind === 'shutdown') {
    disconnectWorker();
    return;
  }
  handleWorkerTask(bridge, message);
}

/**
 * Handles disconnect worker in the service parallel flow.
 */
function disconnectWorker(): void {
  process.disconnect?.();
}

/**
 * Handles worker task in the current service parallel flow.
 */
function handleWorkerTask(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  message: Exclude<ParallelWorkerRequest, { kind: 'shutdown' }>,
): void {
  if (message.kind === 'export') {
    runExport(bridge, message.task);
    return;
  }
  if (message.kind === 'prepare-component') {
    runComponentPreparation(bridge, message.task);
    return;
  }
  runBuild(bridge, message.task);
}

/** Builds and serializes one self-contained component without final meshing. */
function runComponentPreparation(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  task: Extract<ParallelWorkerRequest, { kind: 'prepare-component' }>['task'],
): void {
  const startedAtMs = Date.now();
  const cpuStarted = process.cpuUsage();
  const operation = task.program.ops.at(-1);
  const startEvent = {
    kind: 'op-start' as const,
    timestampMs: startedAtMs,
    partName: task.partName,
    opKind: operation?.kind,
    opName: task.name,
    span: operation?.span,
    bodiesBefore: [],
  };
  sendComponentTrace(task, startEvent);
  try {
    const artifact = prepareArtifact(bridge, task);
    completeComponentPreparation(
      task,
      artifact,
      startEvent,
      startedAtMs,
      cpuStarted,
    );
  } catch (error) {
    sendTaskError(task.taskId, error);
  }
}

/**
 * Derives `ComponentTask` from `Extract< ParallelWorkerRequest, { kind: 'prepare-component' }
 * >['task']` to preserve its type relationship in the service parallel layer.
 */
type ComponentTask = Extract<
  ParallelWorkerRequest,
  { kind: 'prepare-component' }
>['task'];

/**
 * Prepares artifact for the next operation.
 */
function prepareArtifact(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  task: ComponentTask,
): PreparedComponentArtifact {
  const result = bridge.prepareComponent(
    task.program,
    task.name,
    task.semanticConsumerIds,
    task.assets,
  );
  if (!result.ok)
    throw sourceMappedWorkerError(result.error.message, result.error.span);
  return result.artifact;
}

/**
 * Handles send component trace in the service parallel flow.
 */
function sendComponentTrace(task: ComponentTask, event: OcctTraceEvent): void {
  if (task.trace) send({ kind: 'trace', taskId: task.taskId, event });
}

/**
 * Handles complete component preparation in the service parallel flow.
 */
function completeComponentPreparation(
  task: ComponentTask,
  artifact: PreparedComponentArtifact,
  startEvent: OcctTraceEvent,
  startedAtMs: number,
  cpuStarted: NodeJS.CpuUsage,
): void {
  const finishedAtMs = Date.now();
  const successEvent: OcctTraceEvent = {
    kind: 'op-success',
    timestampMs: finishedAtMs,
    elapsedMs: finishedAtMs - startedAtMs,
    partName: task.partName,
    opKind: artifact.operationKind,
    opName: task.name,
    span: artifact.span,
    bodiesBefore: [],
    bodiesAfter: [task.name],
    addedBodies: [task.name],
  };
  sendComponentTrace(task, successEvent);
  send({
    kind: 'component-result',
    output: {
      taskId: task.taskId,
      partName: task.partName,
      sourceIndex: task.sourceIndex,
      recipeDigest: task.recipeDigest,
      artifact,
      traceEvents: task.trace ? [startEvent, successEvent] : [],
      startedAtMs,
      finishedAtMs,
      elapsedMs: finishedAtMs - startedAtMs,
      ...workerTelemetry(cpuStarted),
    },
  });
}

/** Builds one assigned part and reports its complete mergeable result. */
function runBuild(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  task: Extract<ParallelWorkerRequest, { kind: 'build' }>['task'],
): void {
  const startedAt = Date.now();
  const cpuStarted = process.cpuUsage();
  try {
    const result = bridge.build(
      task.program,
      task.assets,
      task.drawingProgram,
      {
        trace: task.trace,
        autoColorOffset: task.autoColorOffset,
        preparedComponents: task.preparedComponents,
        nativeBooleanPlan: task.nativeBooleanPlan,
        nativeBooleanConcurrencyLimit: task.nativeBooleanConcurrencyLimit,
        onTraceEvent: (event) =>
          send({ kind: 'trace', taskId: task.taskId, event }),
      },
    );
    if (!result.ok) {
      sendTaskError(task.taskId, result.error);
      return;
    }
    send({
      kind: 'result',
      output: {
        taskId: task.taskId,
        partName: task.partName,
        sourceIndex: task.sourceIndex,
        meshes: result.meshes,
        drawings: result.drawings,
        ...(result.interaction ? { interaction: result.interaction } : {}),
        validations: result.validations,
        joints: result.joints,
        traceEvents: result.occtTraceEvents ?? [],
        elapsedMs: Date.now() - startedAt,
        ...workerTelemetry(cpuStarted),
      },
    });
  } catch (error) {
    sendTaskError(task.taskId, error);
  }
}

/**
 * Runs export and returns its result.
 */
function runExport(
  bridge: Awaited<ReturnType<typeof getBridge>>,
  task: Extract<ParallelWorkerRequest, { kind: 'export' }>['task'],
): void {
  const startedAt = Date.now();
  const cpuStarted = process.cpuUsage();
  try {
    const result = bridge.export(
      task.program,
      task.format,
      task.assets,
      task.drawingProgram,
      { nativeBooleanPlan: task.nativeBooleanPlan },
    );
    if (!result.ok) {
      sendTaskError(task.taskId, result.error);
      return;
    }
    send({
      kind: 'export-result',
      output: {
        taskId: task.taskId,
        buffers: result.buffers,
        drawings: result.drawings,
        elapsedMs: Date.now() - startedAt,
        ...workerTelemetry(cpuStarted),
      },
    });
  } catch (error) {
    sendTaskError(task.taskId, error);
  }
}

/** Normalizes worker failures into the single coordinator error shape. */
function sendTaskError(taskId: number, error: unknown): void {
  const span = sourceSpanFrom(error);
  send({
    kind: 'error',
    taskId,
    message: workerErrorMessage(error),
    ...(span ? { span } : {}),
  });
}

/**
 * Handles send in the service parallel flow.
 */
function send(message: ParallelWorkerMessage): void {
  process.send?.(message);
}

/** Captures process-owned CPU and resident memory after one OCCT task. */
function workerTelemetry(cpuStarted: NodeJS.CpuUsage): ParallelWorkerTelemetry {
  const cpu = process.cpuUsage(cpuStarted);
  return {
    workerCpuMs: (cpu.user + cpu.system) / 1_000,
    workerRssBytes: process.memoryUsage().rss,
  };
}
