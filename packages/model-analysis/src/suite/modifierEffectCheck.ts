/**
 * @author Aidan Boissonneault
 * @file modifierEffectCheck.ts
 * @purpose Provides modifier effect check behavior for the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import type { ModelAnalysisResult } from '../types/types.js';
import type { SuiteCheck, SuiteModifierEffect } from './suiteTypes.js';

/**
 * Confirms that each declared modifier target changed rendered body identity.
 * A modifier phase can succeed because a different target changed geometry
 * while one selector silently matched nothing. Matching part, kind, and target
 * keeps the physical suite sensitive to each authored modifier statement.
 */
export function modifierEffectCheck(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  required: SuiteModifierEffect[],
): SuiteCheck {
  const changed = new Set(
    analysis.occtTraceEvents
      .filter(
        (event) =>
          event.kind === 'op-success' &&
          event.opKind === 'modifiers' &&
          (event.modifiedBodies?.length ?? 0) > 0,
      )
      .map((event) => `${event.partName}:${event.opName}`),
  );
  const missing = required.filter(
    (effect) =>
      !changed.has(`${effect.partName}:${effect.kind}:${effect.target}`),
  );
  return {
    name: 'Geometry-changing modifier targets',
    passed: missing.length === 0,
    detail:
      missing.length === 0
        ? `${required.length} modifier target(s) changed geometry`
        : `no body change for ${missing
            .map(
              (effect) => `${effect.partName}:${effect.kind}:${effect.target}`,
            )
            .join(', ')}`,
  };
}
