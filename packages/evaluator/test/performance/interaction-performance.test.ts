/**
 * @author Aidan Boissonneault
 * @file interaction-performance.test.ts
 * @purpose Tests interaction performance behavior in the performance in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { evalOk } from '../core/test-support.js';

const PROVENANCE_BUDGET_MS = 1_500;
const TRANSFER_BUDGET_MS = 100;

describe('interaction provenance performance', () => {
  it.each([
    ['small', 1],
    ['large', 240],
  ])(
    'builds and serializes the %s release snapshot within budget',
    (_label, instanceCount) => {
      const started = performance.now();
      const result = evalOk(interactionSource(instanceCount));
      const provenanceMs = performance.now() - started;
      const snapshot = result.program.interaction!;

      const transferStarted = performance.now();
      const transferred = JSON.parse(
        JSON.stringify(snapshot),
      ) as typeof snapshot;
      const transferMs = performance.now() - transferStarted;

      expect(snapshot.entities.length).toBeGreaterThan(instanceCount);
      expect(transferred.entities).toHaveLength(snapshot.entities.length);
      expect(
        provenanceMs,
        `provenance took ${provenanceMs.toFixed(1)} ms`,
      ).toBeLessThan(PROVENANCE_BUDGET_MS);
      expect(
        transferMs,
        `transfer took ${transferMs.toFixed(1)} ms`,
      ).toBeLessThan(TRANSFER_BUDGET_MS);
    },
  );
});

/**
 * Builds the interaction data required by the current scene.
 */
function interactionSource(instanceCount: number): string {
  return `
part interaction_scale {
  for i in range(${instanceCount}) {
    sketch profile = circle(2);
    obj pin = extrude(profile, 2);
  }
}
`;
}
