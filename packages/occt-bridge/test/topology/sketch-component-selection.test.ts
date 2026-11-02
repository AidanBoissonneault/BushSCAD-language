/**
 * @author Aidan Boissonneault
 * @file sketch-component-selection.test.ts
 * @purpose Tests sketch component selection behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { ResolvedSelectionTarget } from '@bushscad/ir';
import { FaceLabelMap } from '../../src/topology/face-labels.js';
import { selectSketchComponentEdges } from '../../src/topology/sketch-component-selection.js';
import { makeMockOC, mockEdge, mockShape } from '../fixtures/topology-mocks.js';

describe('sketch component selection', () => {
  it('selects only the exact qualified member and remaps it to current topology', () => {
    const registered = mockEdge('registered', [-30, 10, 0], [30, 10, 0]);
    const unrelated = mockEdge('unrelated', [-10, -30, 0], [-10, 30, 0]);
    const current = mockEdge('current', [-30, 10, 0], [30, 10, 0]);
    const oc = makeMockOC();
    const labels = new FaceLabelMap();
    labels.register(oc, 'body', mockShape('old-body', [registered, unrelated]));
    labels.registerNamedFaceEdges('body', 'horizontal.top', [registered]);
    labels.registerNamedFaceEdges('body', 'vertical.right', [unrelated]);

    const selected = selectSketchComponentEdges(
      oc,
      labels,
      target(),
      mockShape('current-body', [current]),
    );

    expect(selected).toEqual([current]);
  });
});

/**
 * Handles target in the topology flow.
 */
function target(): ResolvedSelectionTarget {
  return {
    id: 'body:component:horizontal.top',
    label: 'body.horizontal.top',
    ownerEntity: 'body',
    selectorKind: 'named-edge',
    topologyKind: 'edge',
    sketchComponent: {
      componentPath: ['horizontal'],
      member: 'top',
    },
    source: {
      selectorSpan: {
        file: 'test.bscd',
        line: 1,
        col: 1,
        endLine: 1,
        endCol: 21,
      },
      segmentSpans: [],
    },
  };
}
