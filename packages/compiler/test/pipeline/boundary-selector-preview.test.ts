/**
 * @author Aidan Boissonneault
 * @file boundary-selector-preview.test.ts
 * @purpose Tests boundary selector preview behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  interactionLinkedSpans,
  interactionSourceLinkAt,
  interactionValuePreview,
  type InteractionValuePreview,
} from '@bushscad/ir';
import { previewFile } from '../../src/pipeline/previewFile.js';

const CORE_CONTROL_FLOW = example('01_core_control_flow.bscd');
const SURFACE_BOUNDARIES = example('08_surface_boundaries.bscd');
const REFERENCE_SELECTORS = example('07_reference_selectors.bscd');
const CUSTOM_PROFILE = fixture('custom-perimeter-selection.bscd');

describe('boundary selector previews', () => {
  it('keeps a cut rectangular object perimeter on its authored exterior', async () => {
    const result = await previewFile({ filePath: CORE_CONTROL_FLOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const link = interactionSourceLinkAt(
      result.interaction,
      CORE_CONTROL_FLOW,
      60,
      19,
    );
    expect(link?.entityIds).toHaveLength(1);
    expect(link?.topologyIds.length).toBeGreaterThan(0);
    const perimeter = expectDescriptivePreview(
      preview(result.interaction, link),
      12,
    );
    expect(perimeter.values).toEqual(
      expect.arrayContaining([
        expect.stringContaining('base.top.front_edge — line'),
        expect.stringContaining('base.bottom.back_edge — line'),
        expect.stringContaining('base.front.left_edge — line'),
      ]),
    );
    expect(
      interactionLinkedSpans(result.interaction, CORE_CONTROL_FLOW).some(
        (candidate) =>
          candidate.span.line === 58 && candidate.topologyIds.length > 0,
      ),
    ).toBe(true);
  }, 90_000);

  it('separates a face outer perimeter from all of its boundary wires', async () => {
    const result = await previewFile({ filePath: SURFACE_BOUNDARIES });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const perimeter = expectDescriptivePreview(
      previewAt(result.interaction, SURFACE_BOUNDARIES, 16, 41),
      8,
    );
    const edges = expectDescriptivePreview(
      previewAt(result.interaction, SURFACE_BOUNDARIES, 21, 37),
      9,
    );
    expect(
      perimeter.values.filter((value) => value.includes('circular arc')),
    ).toHaveLength(4);
    expect(edges.values.some((value) => value.includes('circle through'))).toBe(
      true,
    );
  }, 90_000);

  it('derives a custom-drawn polygon perimeter from authored topology', async () => {
    const result = await previewFile({ filePath: CUSTOM_PROFILE });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const custom = expectDescriptivePreview(
      previewAt(result.interaction, CUSTOM_PROFILE, 13, 25),
      15,
    );
    expect(
      custom.values.some((value) => value.includes('upper_right.edges')),
    ).toBe(true);
    const curved = expectDescriptivePreview(
      previewAt(result.interaction, CUSTOM_PROFILE, 18, 25),
      2,
    );
    expect(
      curved.values.every((value) => value.includes('circle through')),
    ).toBe(true);
  }, 90_000);

  it('keeps object edges distinct on an unmodified solid', async () => {
    const result = await previewFile({ filePath: REFERENCE_SELECTORS });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expectDescriptivePreview(
      previewAt(result.interaction, REFERENCE_SELECTORS, 57, 19),
      12,
    );
  }, 90_000);
});

/**
 * Derives `Snapshot` from `Parameters<typeof interactionValuePreview>[0]` to preserve its type
 * relationship in the pipeline layer.
 */
type Snapshot = Parameters<typeof interactionValuePreview>[0];
/**
 * Type used for source link.
 */
type SourceLink = ReturnType<typeof interactionSourceLinkAt>;

/**
 * Handles preview in the pipeline flow.
 */
function preview(
  snapshot: Snapshot,
  link: SourceLink,
): InteractionValuePreview | null {
  return interactionValuePreview(
    snapshot,
    link?.entityIds ?? [],
    link?.topologyIds ?? [],
  );
}

/**
 * Handles preview at in the pipeline flow.
 */
function previewAt(
  snapshot: Snapshot,
  file: string,
  line: number,
  col: number,
): InteractionValuePreview | null {
  return preview(snapshot, interactionSourceLinkAt(snapshot, file, line, col));
}

/**
 * Asserts the expected descriptive preview behavior in this test.
 */
function expectDescriptivePreview(
  value: InteractionValuePreview | null,
  total: number,
): InteractionValuePreview {
  expect(value).not.toBeNull();
  expect(value?.total).toBe(total);
  expect(value?.values).toHaveLength(Math.min(total, 12));
  expect(value?.omitted).toBe(Math.max(0, total - 12));
  for (const member of value?.values ?? []) {
    expect(member).toContain(' — ');
    expect(member).toContain('length');
    expect(member).not.toMatch(/\[\d+\]$/);
  }
  return value!;
}

/**
 * Handles example in the pipeline flow.
 */
function example(name: string): string {
  return fileURLToPath(
    new URL(`../../../../examples/test_suite/${name}`, import.meta.url),
  );
}

/**
 * Handles fixture in the pipeline flow.
 */
function fixture(name: string): string {
  return fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));
}
