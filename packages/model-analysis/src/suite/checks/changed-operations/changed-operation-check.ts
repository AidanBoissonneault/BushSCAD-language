import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

type ModelTraceEvent = Extract<
  ModelAnalysisResult,
  { ok: true }
>['occtTraceEvents'][number];

/**
 * Handles changed operation check in the suite flow.
 */
export function changedOperationCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const changed = new Set(
    analysis.occtTraceEvents
      .filter(traceEventChangedBodyIdentity)
      .map((event) => event.opKind)
      .filter((kind): kind is string => Boolean(kind)),
  );
  const required = expected.requiredChangedOperations ?? [];
  const missing = required.filter((kind) => !changed.has(kind));
  return check(
    missing.length === 0,
    'Geometry-changing operations',
    missing.length === 0
      ? `${changed.size} operation kind(s) changed body identity`
      : `no body change for ${missing.join(', ')}`,
  );
}

/**
 * Identifies successful OCCT operations that changed one or more bodies.
 */
export function traceEventChangedBodyIdentity(event: ModelTraceEvent): boolean {
  return (
    event.kind === 'op-success' &&
    ((event.addedBodies?.length ?? 0) > 0 ||
      (event.modifiedBodies?.length ?? 0) > 0 ||
      (event.removedBodies?.length ?? 0) > 0)
  );
}
