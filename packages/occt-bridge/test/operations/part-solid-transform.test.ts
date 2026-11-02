/**
 * @author Aidan Boissonneault
 * @file part-solid-transform.test.ts
 * @purpose Tests part solid transform behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import type { GroupBuildState } from '../../src/bridge/bridge-types.js';
import { replaceDeferredPartComponent } from '../../src/operations/part-solid-transform.js';

describe('deferred part component transforms', () => {
  it('replaces only the selected component and refreshes its aliases', () => {
    const oldMarker = { id: 'old-marker' };
    const plate = { id: 'plate' };
    const movedMarker = { id: 'moved-marker' };
    const state = {
      partSolidOwner: 'assembly',
      partSolidComponents: new Map([
        ['plate', plate],
        ['marker', oldMarker],
      ]),
      partSolidAliasComponents: new Map([
        ['assembly', 'plate'],
        ['plate', 'plate'],
        ['marker', 'marker'],
        ['marker_alias', 'marker'],
      ]),
      partSolidAliasShapes: new Map([
        ['marker', oldMarker],
        ['marker_alias', oldMarker],
      ]),
      bodyShapes: new Map([['assembly', oldMarker]]),
    } as unknown as GroupBuildState;
    const register = vi.fn();

    expect(
      replaceDeferredPartComponent(state, 'marker', movedMarker, register),
    ).toBe(true);
    expect(state.partSolidComponents.get('plate')).toBe(plate);
    expect(state.partSolidComponents.get('marker')).toBe(movedMarker);
    expect(state.partSolidAliasShapes.get('marker_alias')).toBe(movedMarker);
    expect(register).toHaveBeenCalledTimes(2);
  });
});
