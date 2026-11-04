import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles triangle check in the suite flow.
 */
export function triangleCheck(
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
