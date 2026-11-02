/**
 * @author Aidan Boissonneault
 * @file material-shapes.test.ts
 * @purpose Tests material shapes behavior in the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  buildMaterialShapes,
  uniqueBodyEntries,
} from '../../src/mesh/material-shapes.js';

describe('material shape grouping', () => {
  it('compounds same-material bodies that are not isolated', () => {
    const bodyShapes = new Map<string, object>([
      ['body', { id: 'body' }],
      ['rib', { id: 'rib' }],
    ]);
    const entries = uniqueBodyEntries(bodyShapes, new Map());
    const built = buildMaterialShapes(entries, (shapes) => ({
      compound: shapes,
    }));

    expect(built).toHaveLength(1);
    expect(built[0].bodyName).toBeUndefined();
    expect(built[0].shape).toMatchObject({
      compound: [...bodyShapes.values()],
    });
  });

  it('keeps moving joint bodies isolated with a bodyName', () => {
    const moving = { id: 'panel_0' };
    const fixed = { id: 'body' };
    const bodyShapes = new Map<string, object>([
      ['panel_0', moving],
      ['body', fixed],
    ]);
    const entries = uniqueBodyEntries(bodyShapes, new Map());
    const built = buildMaterialShapes(
      entries,
      (shapes) => ({ compound: shapes }),
      new Set(['panel_0']),
    );

    expect(built).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ shape: moving, bodyName: 'panel_0' }),
        expect.objectContaining({ bodyName: 'body' }),
      ]),
    );
  });
});
