/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for compiler package.
 * @last-edited October 6, 2026
 */

export { buildCompilationGraph } from './build-compilation-graph.js';
export type { CompilationGraphOptions } from './build-compilation-graph.js';
export {
  compilationGraphToDot,
  compilationGraphToJson,
  compilationGraphToTree,
} from './graph-diagnostics.js';
export { validateCompilationGraph } from './validate-compilation-graph.js';
export { validateSchedulerCapacity } from './scheduler-capacity.js';
export { SimulatedWorkerPool } from './simulated-worker-pool.js';
export type { SimulatedWorkerPoolOptions } from './simulated-worker-pool.js';
export {
  analyzeSchedulerPriority,
  rankReadySchedulerNodes,
} from './scheduler-priority.js';
export type { SchedulerPriorityAnalysis } from './scheduler-priority.js';
export { simulateCompilationSchedule } from './simulate-compilation-schedule.js';
export { planIndependentPartCompilation } from './independent-part-plan.js';
export type {
  IndependentPartBatch,
  IndependentPartPlan,
} from './independent-part-plan.js';
export { planIndependentComponentCompilation } from './independent-component-plan.js';
export type {
  IndependentComponentPlan,
  IndependentComponentPlanOptions,
} from './independent-component-plan.js';
export {
  cachedPreparedComponentArtifact,
  materializePreparedComponentArtifact,
} from './component-recipe-tasks.js';
export type { PreparedComponentBrepCache } from './prepared-component-cache.js';
export type {
  IndependentComponentConsumer,
  IndependentComponentTask,
} from './component-recipe-tasks.js';
export { planNativeBooleanBatches } from './native-boolean-batch-plan.js';
export type {
  SchedulerArtifact,
  SchedulerCapacity,
  SchedulerCapacityConfiguration,
  SchedulerError,
  SchedulerErrorCode,
  SchedulerGraphExtension,
  SchedulerMetrics,
  SchedulerNodeResult,
  SchedulerNodeStatus,
  SchedulerSimulationOptions,
  SchedulerSimulationResult,
  SchedulerTaskContext,
  SchedulerTaskOutcome,
  SchedulerTaskRunner,
  SchedulerWorkerPool,
  SchedulerWorkerSnapshot,
  SchedulerWorkerState,
} from './scheduler-types.js';
