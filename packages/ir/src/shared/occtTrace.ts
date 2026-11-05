/**
 * @author Aidan Boissonneault
 * @file occtTrace.ts
 * @purpose Provides OpenCascade trace behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from './ir.js';

/**
 * Accepted values for occt trace event kind include build/part/operation lifecycle events,
 * cache-breakpoint, selector-resolution, and native boolean batch events.
 */
export type OcctTraceEventKind =
  | 'build-start'
  | 'part-start'
  | 'op-start'
  | 'op-success'
  | 'op-error'
  | 'cache-breakpoint'
  | 'selector-resolution'
  | 'native-boolean-batch'
  | 'native-boolean-batch-rejected'
  | 'part-success'
  | 'build-success'
  | 'build-error';

/**
 * Accepted values for occt trace engine are 'classic' and 'parallel'.
 */
export type OcctTraceEngine = 'classic' | 'parallel';

/**
 * Accepted values for occt trace phase are 'build', 'part', 'operation', 'selection', and
 * 'native-boolean'.
 */
export type OcctTracePhase =
  'build' | 'part' | 'operation' | 'selection' | 'native-boolean';

/**
 * Accepted values for state for occt trace are 'queued', 'waiting', 'running', 'succeeded',
 * 'failed', 'canceled', and 'skipped'.
 */
export type OcctTraceState =
  | 'queued'
  | 'waiting'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'skipped';

/**
 * Event describing occt trace, including operation kind, timestamp milliseconds, schema version,
 * build id, and event id.
 */
export type OcctTraceEvent = {
  kind: OcctTraceEventKind;
  timestampMs: number;
  /** Additive service-level identity; absent on bridge-local legacy events. */
  schemaVersion?: 2;
  buildId?: string;
  eventId?: string;
  parentEventId?: string;
  engine?: OcctTraceEngine;
  phase?: OcctTracePhase;
  state?: OcctTraceState;
  /** Scheduler-owned identity; never inferred from event arrival order. */
  taskId?: string;
  workerId?: string;
  dependencyTaskIds?: string[];
  waitReason?: string;
  sourceIndex?: number;
  partInstanceId?: string;
  bodyOwner?: string;
  elapsedMs?: number;
  cpuMs?: number;
  partName?: string;
  opKind?: string;
  opName?: string;
  span?: SourceSpan;
  bodiesBefore?: string[];
  bodiesAfter?: string[];
  addedBodies?: string[];
  removedBodies?: string[];
  modifiedBodies?: string[];
  message?: string;
  cacheBreakpoint?: 'automatic' | 'manual';
  cacheHit?: 'component' | 'completed-build';
  requestedSelectorKind?: string;
  resolvedTopologyKind?: string;
  selectorLabel?: string;
  matchCount?: number;
  selectorPhase?: 'expanded' | 'realized';
  batchId?: string;
  batchSize?: number;
  batchMemberNames?: string[];
  batchTargetName?: string;
  nativeApi?: string;
  runParallel?: boolean;
  booleanBuildCount?: number;
  nativeConcurrencyLimit?: number;
};
