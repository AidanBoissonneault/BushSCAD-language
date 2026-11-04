/**
 * @author Aidan Boissonneault
 * @file suiteChecks.ts
 * @purpose Coordinates feature-owned model-analysis suite checks.
 * @last-edited October 6, 2026
 */

import type { ModelAnalysisResult } from '../types/types.js';
import type { SuiteCaseManifest, SuiteCheck } from './suiteTypes.js';
import { modifierEffectCheck } from './modifierEffectCheck.js';
import { check } from './checks/suite-check.js';
import { meshCountCheck } from './checks/mesh-count/mesh-count-check.js';
import { triangleCheck } from './checks/triangles/triangle-check.js';
import { volumeCheck } from './checks/volume/volume-check.js';
import { partCheck } from './checks/parts/part-check.js';
import { operationCheck } from './checks/operations/operation-check.js';
import {
  changedOperationCheck,
  traceEventChangedBodyIdentity,
} from './checks/changed-operations/changed-operation-check.js';
import { validationCheck } from './checks/validations/validation-check.js';
import { warningCheck } from './checks/warnings/warning-check.js';
import { topologyCheck } from './checks/topology/topology-check.js';
import { meshDifferenceCheck } from './checks/mesh-differences/mesh-difference-check.js';
import { screenshotCheck } from './checks/screenshots/screenshot-check.js';

export { traceEventChangedBodyIdentity } from './checks/changed-operations/changed-operation-check.js';

/** Evaluates one compiled model against its declared physical-test contract. */
export function evaluateSuiteCase(
  entry: SuiteCaseManifest,
  analysis: ModelAnalysisResult,
): SuiteCheck[] {
  if (!analysis.ok) {
    return [
      check(false, 'Compile and build', `${analysis.errors.length} error(s)`),
    ];
  }
  const expected = entry.expectations ?? {};
  return [
    check(true, 'Compile and build', 'Compiler and OCCT preview completed'),
    meshCountCheck(analysis.meshes.length, expected),
    triangleCheck(analysis, expected),
    volumeCheck(analysis, expected),
    partCheck(analysis, expected),
    operationCheck(analysis, expected),
    changedOperationCheck(analysis, expected),
    modifierEffectCheck(analysis, expected.requiredChangedModifiers ?? []),
    validationCheck(analysis),
    warningCheck(analysis.warnings.length, expected),
    topologyCheck(analysis, expected),
    meshDifferenceCheck(analysis, expected),
    screenshotCheck(analysis.screenshots),
  ];
}
