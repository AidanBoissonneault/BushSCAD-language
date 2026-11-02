/**
 * @author Aidan Boissonneault
 * @file joint-resolution.test.ts
 * @purpose Tests joint resolution behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IROp } from '@bushscad/ir';
import type { FaceLabelMap } from '../../src/topology/face-labels.js';
import {
  movingJointBodyNames,
  resolveJointsForOps,
} from '../../src/operations/joint-resolution.js';

const SPAN = { file: 'test.bscd', line: 1, col: 1 };

/**
 * Handles joint in the operations flow.
 */
function joint(sideA: string, sideB = 'body.front'): IROp {
  return {
    kind: 'joint',
    name: 'slide',
    jointType: 'slider',
    sideA,
    sideB,
    limitMin: 0,
    limitMax: 55,
    defaultValue: 20,
    span: SPAN,
  };
}

/**
 * Handles labels in the operations flow.
 */
function labels(
  resolved: Map<
    string,
    { origin: [number, number, number]; axis: [number, number, number] }
  >,
): FaceLabelMap {
  return {
    resolveJointAxisRaw: (_oc: unknown, ref: string) =>
      resolved.get(ref) ?? null,
  } as FaceLabelMap;
}

describe('joint resolution', () => {
  it('resolves joints against local body labels', () => {
    const result = resolveJointsForOps(
      {},
      [joint('panel_0.front')],
      labels(
        new Map([['panel_0.front', { origin: [1, 2, 3], axis: [0, -1, 0] }]]),
      ),
    );

    expect(result).toEqual([
      expect.objectContaining({
        name: 'slide',
        jointType: 'slider',
        limitMin: 0,
        limitMax: 55,
        defaultValue: 20,
        origin: [1, 2, 3],
        axis: [0, -1, 0],
        movingPartName: 'panel_0',
        staticPartName: 'body',
      }),
    ]);
  });

  it('resolves joints that are available through the label fallback chain', () => {
    const result = resolveJointsForOps(
      {},
      [joint('drawer.front', 'housing.front')],
      labels(
        new Map([['drawer.front', { origin: [4, 5, 6], axis: [0, 1, 0] }]]),
      ),
    );

    expect(result[0]).toMatchObject({
      origin: [4, 5, 6],
      movingPartName: 'drawer',
      staticPartName: 'housing',
    });
  });

  it('skips unresolved joints without throwing', () => {
    expect(
      resolveJointsForOps({}, [joint('missing.front')], labels(new Map())),
    ).toEqual([]);
  });

  it('extracts moving joint roots for mesh isolation', () => {
    expect([...movingJointBodyNames([joint('panel_0.front')])]).toEqual([
      'panel_0',
    ]);
  });
});
