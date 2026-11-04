import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Builds the mesh data required by the current operation.
 */
export function meshDifferenceCheck(
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
