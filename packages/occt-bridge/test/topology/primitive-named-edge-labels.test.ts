/**
 * @author Aidan Boissonneault
 * @file primitive-named-edge-labels.test.ts
 * @purpose Tests primitive named edge labels behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRRectPrimitive } from '@bushscad/ir';
import { FaceLabelMap } from '../../src/topology/face-labels.js';
import { registerPrimitiveNamedEdgesForBody } from '../../src/topology/primitive-named-edge-labels.js';
import {
  makeMockOC,
  minimalState,
  mockEdge,
  mockShape,
} from '../fixtures/topology-mocks.js';

const FRAME = {
  x: [1, 0, 0] as [number, number, number],
  y: [0, 1, 0] as [number, number, number],
  z: [0, 0, 1] as [number, number, number],
};

/**
 * Creates rectangle geometry from the supplied dimensions.
 */
function rectangle(
  width: number,
  height: number,
  sideNames: IRRectPrimitive['sideNames'],
): IRRectPrimitive {
  return { kind: 'rect', width, height, sideNames };
}

describe('compact primitive named edge labels', () => {
  it('resolves a renamed rectangle side like an extruded profile segment', () => {
    const lower = mockEdge('lower', [-5, -2, 0], [5, -2, 0]);
    const upper = mockEdge('upper', [-5, -2, 3], [5, -2, 3]);
    const leftSeam = mockEdge('left-seam', [-5, -2, 0], [-5, -2, 3]);
    const rightSeam = mockEdge('right-seam', [5, -2, 0], [5, -2, 3]);
    const adjacent = mockEdge('adjacent', [5, -2, 0], [5, 2, 0]);
    const shape = mockShape('body', [
      lower,
      upper,
      leftSeam,
      rightSeam,
      adjacent,
    ]);
    const oc = makeMockOC();
    const labelMap = new FaceLabelMap();
    const state = minimalState(labelMap);
    state.sketchPrimitives.set(
      'plate',
      rectangle(10, 4, { bottom: 'mount_side' }),
    );
    state.bodyFrames.set('body', FRAME);
    labelMap.register(oc, 'body', shape, 'outer', FRAME);

    registerPrimitiveNamedEdgesForBody(oc, state, 'body', 'plate');

    expect(labelMap.resolveEdges(oc, 'body.face.mount_side.edges')).toEqual([
      lower,
      upper,
      leftSeam,
      rightSeam,
    ]);
    expect(labelMap.getNamedFaceEdgeEntries('body')).toHaveLength(1);
  });

  it('applies sketchAt offsets and does not broaden removed Boolean sides', () => {
    const shiftedTop = mockEdge('shifted-top', [12, 6, 0], [8, 6, 0]);
    const unrelated = mockEdge('unrelated', [-2, 3, 0], [2, 3, 0]);
    const shape = mockShape('boolean-body', [shiftedTop, unrelated]);
    const oc = makeMockOC();
    const labelMap = new FaceLabelMap();
    const state = minimalState(labelMap);
    state.sketchPrimitives.set('composite', {
      kind: 'sketchBoolean',
      op: 'subtract',
      left: {
        kind: 'sketchAt',
        primitive: rectangle(4, 2, { top: 'shifted_top' }),
        x: 10,
        y: 5,
      },
      right: rectangle(2, 2, { bottom: 'removed_side' }),
    });
    state.bodyFrames.set('body', FRAME);
    labelMap.register(oc, 'body', shape, 'outer', FRAME);

    registerPrimitiveNamedEdgesForBody(oc, state, 'body', 'composite');

    expect(labelMap.resolveEdges(oc, 'body.face.shifted_top.edges')).toEqual([
      shiftedTop,
    ]);
    expect(labelMap.resolveEdges(oc, 'body.face.removed_side.edges')).toEqual(
      [],
    );
    expect(
      labelMap.getNamedFaceEdgeEntries('body').map(([name]) => name),
    ).toEqual(['shifted_top']);
  });
});
