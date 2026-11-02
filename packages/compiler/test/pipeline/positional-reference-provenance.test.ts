/**
 * @author Aidan Boissonneault
 * @file positional-reference-provenance.test.ts
 * @purpose Tests positional reference provenance behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  interactionSourceLinkAt,
  interactionValuePreview,
  renderedTargetsForEntity,
} from '@bushscad/ir';
import { previewFile } from '../../src/pipeline/previewFile.js';

const CORE_CONTROL_FLOW = example('01_core_control_flow.bscd');
const REFERENCE_SELECTORS = example('07_reference_selectors.bscd');

describe('positional reference provenance', () => {
  it('realizes every non-array placement selector as one reference point', async () => {
    const result = await previewFile({ filePath: CORE_CONTROL_FLOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expectSingularPlacementEntities(result);

    const cornerLink = interactionSourceLinkAt(
      result.interaction,
      CORE_CONTROL_FLOW,
      58,
      55,
    );
    expect(cornerLink?.entityIds).toHaveLength(1);
    expect(cornerLink?.topologyIds).toHaveLength(1);
    expect(
      interactionValuePreview(
        result.interaction,
        cornerLink?.entityIds ?? [],
        cornerLink?.topologyIds ?? [],
      ),
    ).toBeNull();
  }, 90_000);

  it('keeps generated objects indexed while indexed placements stay singular', async () => {
    const result = await previewFile({ filePath: REFERENCE_SELECTORS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const declaration = interactionSourceLinkAt(
      result.interaction,
      REFERENCE_SELECTORS,
      42,
      10,
    );
    expect(
      interactionValuePreview(
        result.interaction,
        declaration?.entityIds ?? [],
        declaration?.topologyIds ?? [],
      )?.values,
    ).toEqual(['pocket[0]', 'pocket[1]']);

    const indexedPlacement = interactionSourceLinkAt(
      result.interaction,
      REFERENCE_SELECTORS,
      43,
      64,
    );
    expect(indexedPlacement?.entityIds).toHaveLength(1);
    expect(indexedPlacement?.topologyIds).toHaveLength(1);
  }, 90_000);
});

/**
 * Selected members of Awaited<ReturnType<typeof previewFile>> used for successful preview.
 */
type SuccessfulPreview = Extract<
  Awaited<ReturnType<typeof previewFile>>,
  { ok: true }
>;

/**
 * Asserts the expected singular placement entities behavior in this test.
 */
function expectSingularPlacementEntities(result: SuccessfulPreview): void {
  const placements = result.interaction.entities.filter(
    (entity) => entity.selectorKind && entity.placement,
  );
  expect(placements.length).toBeGreaterThan(10);
  for (const entity of placements) {
    const targetIds = renderedTargetsForEntity(result.interaction, entity.id);
    expect(entity.rendered, entity.name).toBe(true);
    expect(targetIds, entity.name).toHaveLength(1);
    expect(
      result.interaction.topology.some((mesh) =>
        mesh.faces.some((face) => face.semanticTargetIds.includes(entity.id)),
      ),
      `${entity.name} leaked onto a face`,
    ).toBe(false);
    expect(
      result.interaction.topology
        .flatMap((mesh) => mesh.corners)
        .find((point) => targetIds.includes(point.id))?.role,
    ).toBe('reference-point');
  }
}

/**
 * Handles example in the pipeline flow.
 */
function example(name: string): string {
  return fileURLToPath(
    new URL(`../../../../examples/test_suite/${name}`, import.meta.url),
  );
}
