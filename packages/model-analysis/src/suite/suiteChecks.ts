/**
 * @author Aidan Boissonneault
 * @file suiteChecks.ts
 * @purpose Provides suite checks behavior for the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import type { ModelAnalysisResult } from '../types/types.js';
import type {
  SuiteCaseManifest,
  SuiteCheck,
  SuiteExpectation,
} from './suiteTypes.js';
import { modifierEffectCheck } from './modifierEffectCheck.js';

type ModelTraceEvent = Extract<
  ModelAnalysisResult,
  { ok: true }
>['occtTraceEvents'][number];

/** Evaluates one compiled model against its declared physical-test contract. */
export function evaluateSuiteCase(
  entry: SuiteCaseManifest,
  analysis: ModelAnalysisResult,
): SuiteCheck[] {
  if (!analysis.ok) {
    return [
      check(false, 'Compile and build', `${analysis.errors.length} error(s)`),
    ];
  }
  const expected = entry.expectations ?? {};
  return [
    check(true, 'Compile and build', 'Compiler and OCCT preview completed'),
    meshCountCheck(analysis.meshes.length, expected),
    triangleCheck(analysis, expected),
    volumeCheck(analysis, expected),
    partCheck(analysis, expected),
    operationCheck(analysis, expected),
    changedOperationCheck(analysis, expected),
    modifierEffectCheck(analysis, expected.requiredChangedModifiers ?? []),
    validationCheck(analysis),
    warningCheck(analysis.warnings.length, expected),
    topologyCheck(analysis, expected),
    meshDifferenceCheck(analysis, expected),
    screenshotCheck(analysis.screenshots),
  ];
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshCountCheck(count: number, expected: SuiteExpectation): SuiteCheck {
  const min = expected.minMeshes ?? 1;
  const max = expected.maxMeshes ?? Number.POSITIVE_INFINITY;
  return check(
    count >= min && count <= max,
    'Mesh count',
    `${count} mesh(es), expected ${min}..${Number.isFinite(max) ? max : 'Infinity'}`,
  );
}

/**
 * Handles triangle check in the suite flow.
 */
function triangleCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const count = analysis.meshes.reduce(
    (sum, mesh) => sum + mesh.triangleCount,
    0,
  );
  const min = expected.minTriangles ?? 1;
  return check(count >= min, 'Rendered triangles', `${count}, minimum ${min}`);
}

/**
 * Handles volume check in the suite flow.
 */
function volumeCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const volume = analysis.meshes.reduce(
    (sum, mesh) => sum + Math.abs(mesh.signedVolume),
    0,
  );
  const min = expected.minAbsoluteVolume ?? 0;
  return check(
    volume >= min,
    'Absolute volume',
    `${volume.toFixed(3)} mm^3, minimum ${min}`,
  );
}

/**
 * Handles part check in the suite flow.
 */
function partCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const actual = new Set(analysis.meshes.map((mesh) => mesh.partName));
  const required = expected.requiredParts ?? [];
  const missing = required.filter((name) => !actual.has(name));
  return check(
    missing.length === 0,
    'Required parts',
    missing.length === 0
      ? `${actual.size} rendered part(s)`
      : `missing ${missing.join(', ')}`,
  );
}

/**
 * Dispatches the operation to its matching action handler.
 */
function operationCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const actual = new Set(
    analysis.operations.map((operation) => operation.kind),
  );
  const required = expected.requiredOperations ?? [];
  const missing = required.filter((kind) => !actual.has(kind));
  return check(
    missing.length === 0,
    'Required IR operations',
    missing.length === 0
      ? `${actual.size} operation kind(s)`
      : `missing ${missing.join(', ')}`,
  );
}

/**
 * Handles changed operation check in the suite flow.
 */
function changedOperationCheck(
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
export function traceEventChangedBodyIdentity(
  event: ModelTraceEvent,
): boolean {
  return (
    event.kind === 'op-success' &&
    ((event.addedBodies?.length ?? 0) > 0 ||
      (event.modifiedBodies?.length ?? 0) > 0 ||
      (event.removedBodies?.length ?? 0) > 0)
  );
}

/**
 * Handles validation check in the suite flow.
 */
function validationCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
): SuiteCheck {
  const failed = analysis.validations.filter(
    (validation) => !validation.passed,
  );
  return check(
    failed.length === 0,
    'Design validations',
    failed.length === 0
      ? `${analysis.validations.length} validation(s) passed`
      : failed.map((validation) => validation.message).join('; '),
  );
}

/**
 * Handles warning check in the suite flow.
 */
function warningCheck(count: number, expected: SuiteExpectation): SuiteCheck {
  const max = expected.maxWarnings ?? 0;
  return check(count <= max, 'Analysis warnings', `${count}, maximum ${max}`);
}

/**
 * Handles topology check in the suite flow.
 */
function topologyCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const totals = analysis.meshes.reduce(
    (sum, mesh) => ({
      degenerate: sum.degenerate + mesh.issues.degenerateTriangles,
      normals: sum.normals + mesh.issues.invalidNormals,
      boundary: sum.boundary + mesh.issues.boundaryEdges,
      nonManifold: sum.nonManifold + mesh.issues.nonManifoldEdges,
      disconnected: sum.disconnected + mesh.issues.disconnectedComponents,
    }),
    { degenerate: 0, normals: 0, boundary: 0, nonManifold: 0, disconnected: 0 },
  );
  const passed =
    totals.degenerate <= maxIssue(expected, 'degenerateTriangles', 0) &&
    totals.normals <= maxIssue(expected, 'invalidNormals', 0) &&
    totals.nonManifold <= maxIssue(expected, 'nonManifoldEdges', 0) &&
    totals.boundary <=
      maxIssue(
        expected,
        'boundaryEdges',
        expected.allowBoundaryEdges === true ? Number.POSITIVE_INFINITY : 0,
      ) &&
    totals.disconnected <=
      maxIssue(
        expected,
        'disconnectedComponents',
        expected.allowDisconnectedComponents === true
          ? Number.POSITIVE_INFINITY
          : analysis.meshes.length,
      );
  return check(passed, 'Topology health', JSON.stringify(totals));
}

/**
 * Handles max issue in the suite flow.
 */
function maxIssue(
  expected: SuiteExpectation,
  issue: keyof NonNullable<SuiteExpectation['maxTopologyIssues']>,
  fallback: number,
): number {
  return expected.maxTopologyIssues?.[issue] ?? fallback;
}

/**
 * Handles screenshot check in the suite flow.
 */
function screenshotCheck(paths: string[]): SuiteCheck {
  return check(
    paths.length >= 6,
    'Rendered views',
    `${paths.length} screenshot(s)`,
  );
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshDifferenceCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  expected: SuiteExpectation,
): SuiteCheck {
  const differences = expected.requiredMeshMetricDifferences ?? [];
  const failed: string[] = [];
  for (const requirement of differences) {
    if (!hasRequiredMeshDifference(analysis, requirement)) {
      failed.push(
        `${requirement.leftBody}.${requirement.metric} vs ${requirement.rightBody}.${requirement.metric}`,
      );
    }
  }
  return check(
    failed.length === 0,
    'Required physical differences',
    failed.length === 0
      ? `${differences.length} metric difference(s) confirmed`
      : `missing ${failed.join(', ')}`,
  );
}

/**
 * Checks that both named meshes exist and differ by the required metric amount.
 */
function hasRequiredMeshDifference(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  requirement: NonNullable<
    SuiteExpectation['requiredMeshMetricDifferences']
  >[number],
): boolean {
  const left = analysis.meshes.find(
    (mesh) => mesh.bodyName === requirement.leftBody,
  );
  const right = analysis.meshes.find(
    (mesh) => mesh.bodyName === requirement.rightBody,
  );
  if (!left || !right) return false;
  const difference = Math.abs(
    meshMetric(left, requirement.metric) -
      meshMetric(right, requirement.metric),
  );
  return difference >= (requirement.minimumDifference ?? 1e-9);
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshMetric(
  mesh: Extract<ModelAnalysisResult, { ok: true }>['meshes'][number],
  metric: NonNullable<
    SuiteExpectation['requiredMeshMetricDifferences']
  >[number]['metric'],
): number {
  if (metric === 'absoluteVolume') return Math.abs(mesh.signedVolume);
  return mesh[metric];
}

/**
 * Handles check in the suite flow.
 */
function check(passed: boolean, name: string, detail: string): SuiteCheck {
  return { passed, name, detail };
}
