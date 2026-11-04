/** Creates a named check result for one model-analysis suite criterion. */
import type { SuiteCheck } from '../suiteTypes.js';

export function check(
  passed: boolean,
  name: string,
  detail: string,
): SuiteCheck {
  return { passed, name, detail };
}
