/**
 * @author Aidan Boissonneault
 * @file worker-protocol.ts
 * @purpose Provides worker protocol behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type {
  CompileAssets,
  DrawingProgram,
  DrawingResult,
  SourceSpan,
  ExportFormat,
  IRProgram,
  InteractionSnapshot,
  MeshData,
  NativeBooleanBatchPlan,
  OcctTraceEvent,
  PreparedComponentArtifact,
  ResolvedJointData,
  ValidationResult,
} from '@bushscad/ir';

/**
 * Parallel build task, including task id, part name, source index, auto color offset, and
 * program.
 */
export type ParallelBuildTask = {
  taskId: number;
  partName: string;
  sourceIndex: number;
  autoColorOffset: number;
  program: IRProgram;
  assets: CompileAssets;
  trace: boolean;
  drawingProgram?: DrawingProgram;
  preparedComponents?: PreparedComponentArtifact[];
  nativeBooleanPlan?: NativeBooleanBatchPlan;
  nativeBooleanConcurrencyLimit?: number;
};

/**
 * Parallel worker telemetry, including worker cpu milliseconds and worker rss bytes.
 */
export type ParallelWorkerTelemetry = {
  workerCpuMs: number;
  workerRssBytes: number;
};

/**
 * Derives `ParallelBuildOutput` from `ParallelWorkerTelemetry & { taskId: number; partName: string;
 * sourceIndex: number; meshes: MeshData[]; drawings: DrawingResult[]; interaction?:
 * InteractionSnapshot; validations: ValidationResult[]; joints: ResolvedJointData[]; traceEvents:
 * OcctTraceEvent[]; elapsedMs: number; }` to preserve its type relationship in the service parallel
 * layer.
 */
export type ParallelBuildOutput = ParallelWorkerTelemetry & {
  taskId: number;
  partName: string;
  sourceIndex: number;
  meshes: MeshData[];
  drawings: DrawingResult[];
  interaction?: InteractionSnapshot;
  validations: ValidationResult[];
  joints: ResolvedJointData[];
  traceEvents: OcctTraceEvent[];
  elapsedMs: number;
};

/**
 * Parallel component task, including task id, part name, source index, name, and recipe digest.
 */
export type ParallelComponentTask = {
  taskId: number;
  partName: string;
  sourceIndex: number;
  name: string;
  recipeDigest: string;
  program: IRProgram;
  assets: CompileAssets;
  semanticConsumerIds: string[];
  trace: boolean;
};

/**
 * Derives `ParallelComponentOutput` from `ParallelWorkerTelemetry & { taskId: number; partName:
 * string; sourceIndex: number; recipeDigest: string; artifact: PreparedComponentArtifact; traceEvents:
 * OcctTraceEvent[]; startedAtMs: number; finishedAtMs: number; elapsedMs: number; }` to preserve its
 * type relationship in the service parallel layer.
 */
export type ParallelComponentOutput = ParallelWorkerTelemetry & {
  taskId: number;
  partName: string;
  sourceIndex: number;
  recipeDigest: string;
  artifact: PreparedComponentArtifact;
  traceEvents: OcctTraceEvent[];
  startedAtMs: number;
  finishedAtMs: number;
  elapsedMs: number;
};

/**
 * Parallel export task, including task id, program, assets, drawing program, and export format.
 */
export type ParallelExportTask = {
  taskId: number;
  program: IRProgram;
  assets: CompileAssets;
  drawingProgram: DrawingProgram;
  format: ExportFormat;
  nativeBooleanPlan?: NativeBooleanBatchPlan;
};

/**
 * Derives `ParallelExportOutput` from `ParallelWorkerTelemetry & { taskId: number; buffers: { name:
 * string; data: ArrayBuffer }[]; drawings: DrawingResult[]; elapsedMs: number; }` to preserve its type
 * relationship in the service parallel layer.
 */
export type ParallelExportOutput = ParallelWorkerTelemetry & {
  taskId: number;
  buffers: { name: string; data: ArrayBuffer }[];
  drawings: DrawingResult[];
  elapsedMs: number;
};

/**
 * Request to parallel worker is tagged by kind: 'build' carries task, 'prepare-component'
 * carries task, 'export' carries task, and 'shutdown'.
 */
export type ParallelWorkerRequest =
  | { kind: 'build'; task: ParallelBuildTask }
  | { kind: 'prepare-component'; task: ParallelComponentTask }
  | { kind: 'export'; task: ParallelExportTask }
  | { kind: 'shutdown' };

/**
 * Message for parallel worker is tagged by kind: 'ready' carries startup duration, worker rss
 * bytes, 'trace' carries task id, event, 'result' carries output, 'component-result' carries
 * output, 'export-result' carries output, and 'error' carries task id, message, span.
 */
export type ParallelWorkerMessage =
  | { kind: 'ready'; startupMs: number; workerRssBytes: number }
  | { kind: 'trace'; taskId: number; event: OcctTraceEvent }
  | { kind: 'result'; output: ParallelBuildOutput }
  | { kind: 'component-result'; output: ParallelComponentOutput }
  | { kind: 'export-result'; output: ParallelExportOutput }
  | { kind: 'error'; taskId: number; message: string; span?: SourceSpan };

/**
 * Status of parallel pool, including current state, desired worker count, warming workers, ready
 * worker count, and busy workers.
 */
export type ParallelPoolStatus = {
  state: 'warming' | 'ready' | 'busy' | 'degraded' | 'failed' | 'stopped';
  desiredWorkers: number;
  warmingWorkers: number;
  readyWorkers: number;
  busyWorkers: number;
  failedWorkers: number;
  startupMs: number;
  aggregateWorkerRssBytes: number;
  peakAggregateWorkerRssBytes: number;
};
