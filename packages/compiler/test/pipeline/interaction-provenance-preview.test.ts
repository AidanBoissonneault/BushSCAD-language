/**
 * @author Aidan Boissonneault
 * @file interaction-provenance-preview.test.ts
 * @purpose Tests interaction provenance preview behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  interactionValuePreview,
  interactionObjectContextAt,
  interactionSourceLinkAt,
  renderedTargetsForEntity,
  sourceEntitiesForTarget,
} from '@bushscad/ir';
import { previewFile } from '../../src/pipeline/previewFile.js';

const REPRESENTATIVE_MODEL = fileURLToPath(
  new URL(
    '../../../../examples/test_suite/07_reference_selectors.bscd',
    import.meta.url,
  ),
);
const FIRST_EXAMPLE = fileURLToPath(
  new URL(
    '../../../../examples/test_suite/01_core_control_flow.bscd',
    import.meta.url,
  ),
);
const REPEATED_EXTRUSIONS = fileURLToPath(
  new URL('../fixtures/repeated-extrude-interaction.bscd', import.meta.url),
);

describe('preview interaction provenance', () => {
  it('links a repeated cut declaration and expression to every complete cavity', async () => {
    const result = await previewFile({ filePath: FIRST_EXAMPLE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expectFirstExamplePresentation(result);

    const declaration = interactionSourceLinkAt(
      result.interaction,
      FIRST_EXAMPLE,
      36,
      14,
    );
    const effect = interactionObjectContextAt(
      result.interaction,
      FIRST_EXAMPLE,
      36,
      30,
    );
    expect(declaration?.entityIds).toHaveLength(4);
    expect(effect?.entityIds).toEqual(declaration?.entityIds);

    expectCompleteFeatureTopology(result, declaration?.entityIds ?? []);
    expectGridPlacementPoints(result);
  }, 90_000);

  it('links every complete additive feature from a repeated extrusion', async () => {
    const result = await previewFile({ filePath: REPEATED_EXTRUSIONS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const declaration = interactionSourceLinkAt(
      result.interaction,
      REPEATED_EXTRUSIONS,
      9,
      14,
    );
    expect(declaration?.entityIds).toHaveLength(2);
    for (const entityId of declaration?.entityIds ?? []) {
      expect(
        result.interaction.topology.flatMap((mesh) =>
          mesh.faces.filter((face) =>
            face.semanticTargetIds.includes(entityId),
          ),
        ).length,
      ).toBeGreaterThanOrEqual(2);
    }
  }, 90_000);

  it('returns bidirectional realized topology within the release payload budget', async () => {
    const result = await previewFile({ filePath: REPRESENTATIVE_MODEL });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.interaction.topology.length).toBeGreaterThan(0);
    expect(
      result.interaction.entities.some(
        (entity) => entity.kind === 'generated-instance',
      ),
    ).toBe(true);
    for (const meshTopology of result.interaction.topology) {
      const mesh = result.meshes[meshTopology.meshIndex];
      expect(mesh).toBeDefined();
      expect(
        meshTopology.faces.reduce(
          (total, face) => total + face.triangleCount,
          0,
        ),
      ).toBe(mesh!.indices.length / 3);
      expect(meshTopology.edges.length).toBeGreaterThan(0);
      expect(meshTopology.corners.length).toBeGreaterThan(0);
    }

    const linkedEntity = result.interaction.entities.find(
      (entity) =>
        entity.rendered &&
        renderedTargetsForEntity(result.interaction, entity.id).length > 0,
    );
    expect(linkedEntity).toBeDefined();
    const targetId = renderedTargetsForEntity(
      result.interaction,
      linkedEntity!.id,
    )[0]!;
    expect(
      sourceEntitiesForTarget(result.interaction, targetId).length,
    ).toBeGreaterThan(0);
    const renderedSelectorKinds = new Set(
      result.interaction.entities
        .filter(
          (entity) =>
            entity.rendered && ['face', 'edge', 'corner'].includes(entity.kind),
        )
        .map((entity) => entity.kind),
    );
    expect(renderedSelectorKinds.has('edge')).toBe(true);
    const corner = result.interaction.topology
      .flatMap((mesh) => mesh.corners)
      .at(0);
    expect(corner).toBeDefined();
    expect(
      sourceEntitiesForTarget(result.interaction, corner!.id).length,
    ).toBeGreaterThan(0);
    const referencePoints = result.interaction.topology
      .flatMap((mesh) => mesh.corners)
      .filter((point) => point.role === 'reference-point');
    expect(referencePoints.length).toBeGreaterThan(0);
    for (const point of referencePoints) {
      expect(
        result.interaction.topology
          .flatMap((mesh) => mesh.corners)
          .filter(
            (candidate) =>
              candidate.role === 'reference-point' &&
              point.semanticTargetIds.some((id) =>
                candidate.semanticTargetIds.includes(id),
              ),
          ),
      ).toHaveLength(1);
      expect(
        result.interaction.topology.some((mesh) =>
          mesh.faces.some((face) =>
            point.semanticTargetIds.some((id) =>
              face.semanticTargetIds.includes(id),
            ),
          ),
        ),
      ).toBe(false);
    }

    const startedAt = performance.now();
    const payload = JSON.stringify(result.interaction);
    const serializationMs = performance.now() - startedAt;
    const cloneStartedAt = performance.now();
    structuredClone(result.interaction);
    const transferCloneMs = performance.now() - cloneStartedAt;
    expect(Buffer.byteLength(payload)).toBeLessThan(2 * 1024 * 1024);
    expect(serializationMs).toBeLessThan(50);
    expect(transferCloneMs).toBeLessThan(50);

    expectArrayPreviews(result);
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
 * Asserts the expected first example presentation behavior in this test.
 */
function expectFirstExamplePresentation(result: SuccessfulPreview): void {
  expect(result.meshes[0]).toMatchObject({
    color: '#FFFFFF',
    material: { color: '#FFFFFF', texture: 'matte' },
  });
  expect(result.meshes[0]?.usesDefaultColor).not.toBe(true);
}

/**
 * Asserts the expected complete feature topology behavior in this test.
 */
function expectCompleteFeatureTopology(
  result: SuccessfulPreview,
  entityIds: readonly string[],
): void {
  for (const entityId of entityIds) {
    const featureFaces = result.interaction.topology.flatMap((mesh) =>
      mesh.faces.filter((face) => face.semanticTargetIds.includes(entityId)),
    );
    const featureEdges = result.interaction.topology.flatMap((mesh) =>
      mesh.edges.filter((edge) => edge.semanticTargetIds.includes(entityId)),
    );
    expect(featureFaces.length).toBeGreaterThanOrEqual(2);
    expect(featureEdges.length).toBeGreaterThanOrEqual(2);
  }
}

/**
 * Asserts the expected grid placement points behavior in this test.
 */
function expectGridPlacementPoints(result: SuccessfulPreview): void {
  const gridReference = result.interaction.references.find(
    (reference) => reference.span.line === 36,
  );
  const gridPlacements = gridReference?.targetIds.map((targetId) =>
    result.interaction.entities.find((entity) => entity.id === targetId),
  );
  expect(gridPlacements).toHaveLength(4);
  const positions = gridPlacements?.map((entity) =>
    JSON.stringify([entity?.placement?.offsetX, entity?.placement?.offsetY]),
  );
  expect(new Set(positions).size).toBe(4);
  for (const entity of gridPlacements ?? []) {
    expect(entity?.placement?.faceRef).toBe('base.top.corner.front_left');
    expect(hasReferencePoint(result, entity!.id)).toBe(true);
  }
}

/**
 * Asserts the expected array previews behavior in this test.
 */
function expectArrayPreviews(result: SuccessfulPreview): void {
  /**
   * Handles preview at in the pipeline flow.
   */
  const previewAt = (line: number, col: number) => {
    const link = interactionSourceLinkAt(
      result.interaction,
      REPRESENTATIVE_MODEL,
      line,
      col,
    );
    return interactionValuePreview(
      result.interaction,
      link?.entityIds ?? [],
      link?.topologyIds ?? [],
    );
  };
  expect(previewAt(20, 19)?.values).toEqual([
    'body.top.perimeter',
    'body.bottom.perimeter',
  ]);
  expect(previewAt(57, 19)?.total).toBeGreaterThan(1);
  expect(previewAt(42, 10)?.total).toBe(2);
}

/**
 * Checks whether the input has reference point.
 */
function hasReferencePoint(
  result: SuccessfulPreview,
  entityId: string,
): boolean {
  return result.interaction.topology.some((mesh) =>
    mesh.corners.some(
      (point) =>
        point.role === 'reference-point' &&
        point.semanticTargetIds.includes(entityId),
    ),
  );
}
