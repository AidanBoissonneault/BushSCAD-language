/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for compiler package.
 * @last-edited October 6, 2026
 */

export { compileSource } from './pipeline/compileSource.js';
export { compileDocument } from './pipeline/compileDocument.js';
export {
  buildCompilationGraph,
  compilationGraphToDot,
  compilationGraphToJson,
  compilationGraphToTree,
  analyzeSchedulerPriority,
  rankReadySchedulerNodes,
  simulateCompilationSchedule,
  planIndependentPartCompilation,
  planIndependentComponentCompilation,
  planNativeBooleanBatches,
  cachedPreparedComponentArtifact,
  materializePreparedComponentArtifact,
  SimulatedWorkerPool,
  validateSchedulerCapacity,
  validateCompilationGraph,
} from './pipeline/parallel-compilation/index.js';
export type {
  CompilationGraphOptions,
  SchedulerArtifact,
  SchedulerCapacity,
  SchedulerCapacityConfiguration,
  SchedulerError,
  SchedulerErrorCode,
  SchedulerGraphExtension,
  SchedulerMetrics,
  SchedulerNodeResult,
  SchedulerNodeStatus,
  SchedulerPriorityAnalysis,
  SchedulerSimulationOptions,
  SchedulerSimulationResult,
  SchedulerTaskContext,
  SchedulerTaskOutcome,
  SchedulerTaskRunner,
  SchedulerWorkerPool,
  SchedulerWorkerSnapshot,
  SchedulerWorkerState,
  SimulatedWorkerPoolOptions,
  IndependentPartBatch,
  IndependentPartPlan,
  IndependentComponentPlan,
  IndependentComponentPlanOptions,
  IndependentComponentConsumer,
  IndependentComponentTask,
  PreparedComponentBrepCache,
} from './pipeline/parallel-compilation/index.js';
export { collectEnvManifest, coerceEnvOverrides } from './core/env.js';
export {
  BUSHSCAD_SOURCE_EXTENSION,
  isBushScadFile,
  normalizePath,
} from './core/paths.js';
export type {
  CompileDocumentInput,
  CompileDocumentResult,
  CompileSourceInput,
  EnvManifestEntry,
  EnvValue,
  EnvValueType,
  RawEnvOverrides,
  CacheBreakpoint,
} from './types/types.js';
export { buildWorkspaceIndex } from './workspace/buildWorkspaceIndex.js';
export { entrypointsAffectedByPath } from './workspace/entrypointsAffectedByPath.js';
export { resolveWorkspaceEntrypoint } from './workspace/resolveWorkspaceEntrypoint.js';
export type {
  ProjectManifest,
  WorkspaceEntrypoint,
  WorkspaceFile,
  WorkspaceIndex,
  WorkspaceIndexInput,
} from './workspace/types.js';
