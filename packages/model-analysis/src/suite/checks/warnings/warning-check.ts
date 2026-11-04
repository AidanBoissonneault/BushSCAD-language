import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles warning check in the suite flow.
 */
export function warningCheck(
  count: number,
  expected: SuiteExpectation,
): SuiteCheck {
  const max = expected.maxWarnings ?? 0;
  return check(count <= max, 'Analysis warnings', `${count}, maximum ${max}`);
}
