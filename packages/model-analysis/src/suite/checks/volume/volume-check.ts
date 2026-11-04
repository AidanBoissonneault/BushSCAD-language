import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles volume check in the suite flow.
 */
export function volumeCheck(
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
