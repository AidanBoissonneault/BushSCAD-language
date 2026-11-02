/**
 * @author Aidan Boissonneault
 * @file perimeter-fillet-preview.test.ts
 * @purpose Tests perimeter fillet preview behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { previewFile } from '../../src/pipeline/previewFile.js';

const CLOSED_BODY_REGRESSION = fileURLToPath(
  new URL(
    '../../../../examples/sketch-closed-body-regression.bscd',
    import.meta.url,
  ),
);

describe('perimeter fillet preview regressions', () => {
  it('builds the closed-body model without a perimeter fillet validation', async () => {
    const result = await previewFile({ filePath: CLOSED_BODY_REGRESSION });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.validations).toEqual([]);
  }, 60_000);
});
