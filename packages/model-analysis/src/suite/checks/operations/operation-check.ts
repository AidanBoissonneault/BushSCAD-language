import type { ModelAnalysisResult } from '../../../types/types.js';
import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Dispatches the operation to its matching action handler.
 */
export function operationCheck(
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
