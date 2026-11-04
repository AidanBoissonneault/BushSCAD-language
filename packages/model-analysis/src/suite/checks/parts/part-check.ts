import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles part check in the suite flow.
 */
export function partCheck(
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
