import type { SuiteCheck } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Handles screenshot check in the suite flow.
 */
export function screenshotCheck(paths: string[]): SuiteCheck {
  return check(
    paths.length >= 6,
    'Rendered views',
    `${paths.length} screenshot(s)`,
  );
}
