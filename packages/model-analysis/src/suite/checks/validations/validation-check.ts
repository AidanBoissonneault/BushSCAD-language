import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles validation check in the suite flow.
 */
export function validationCheck(
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
