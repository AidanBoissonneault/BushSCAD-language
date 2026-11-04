import type { SuiteCheck, SuiteExpectation } from '../../suiteTypes.js';
import { check } from '../suite-check.js';

/**
 * Builds the mesh data required by the current operation.
 */
export function meshCountCheck(
  count: number,
  expected: SuiteExpectation,
): SuiteCheck {
  const min = expected.minMeshes ?? 1;
  const max = expected.maxMeshes ?? Number.POSITIVE_INFINITY;
  return check(
    count >= min && count <= max,
    'Mesh count',
    `${count} mesh(es), expected ${min}..${Number.isFinite(max) ? max : 'Infinity'}`,
  );
}
