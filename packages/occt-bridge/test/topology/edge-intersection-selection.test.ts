/**
 * @author Aidan Boissonneault
 * @file edge-intersection-selection.test.ts
 * @purpose Tests edge intersection selection behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { ResolvedSelectionTarget } from '@bushscad/ir';
import { FaceLabelMap } from '../../src/topology/face-labels.js';
import {
  edgeIntersectionFailure,
  selectEdgeIntersection,
} from '../../src/topology/edge-intersection-selection.js';
import { makeMockOC, mockEdge, mockShape } from '../fixtures/topology-mocks.js';

describe('edge intersection selection', () => {
  it('returns shared generated edges once in geometric order', () => {
    const upper = mockEdge('upper', [5, 2, 0], [5, 2, 4]);
    const lower = mockEdge('lower', [-5, -2, 0], [-5, -2, 4]);
    const onlyFirst = mockEdge('first-only', [0, -5, 0], [0, -5, 4]);
    const oc = makeMockOC();
    const labels = new FaceLabelMap();
    labels.register(oc, 'body', mockShape('body', [upper, lower, onlyFirst]));
    labels.registerNamedFaceEdges('body', 'first', [upper, lower, onlyFirst]);
    labels.registerNamedFaceEdges('body', 'second', [upper, lower]);

    const result = selectEdgeIntersection(oc, labels, target(undefined));

    expect(result.all).toEqual([upper, lower]);
    expect(result.selected).toEqual([upper, lower]);
  });

  it('selects one crossing and diagnoses an out-of-range index', () => {
    const crossing = mockEdge('crossing', [0, 0, 0], [0, 0, 4]);
    const oc = makeMockOC();
    const labels = new FaceLabelMap();
    labels.register(oc, 'body', mockShape('body', [crossing]));
    labels.registerNamedFaceEdges('body', 'first', [crossing]);
    labels.registerNamedFaceEdges('body', 'second', [crossing]);
    const selection = target(3);
    const result = selectEdgeIntersection(oc, labels, selection);

    expect(result.selected).toEqual([]);
    expect(edgeIntersectionFailure(selection, result)).toContain(
      'index 3 is out of range for 1 crossing edge',
    );
  });

  it('reselects the crossing from the current modifier shape', () => {
    const registered = mockEdge('registered', [2, 3, 0], [2, 3, 4]);
    const current = mockEdge('current', [2, 3, 0], [2, 3, 4]);
    const oc = makeMockOC();
    const labels = new FaceLabelMap();
    labels.register(oc, 'body', mockShape('old-body', [registered]));
    labels.registerNamedFaceEdges('body', 'first', [registered]);
    labels.registerNamedFaceEdges('body', 'second', [registered]);

    const result = selectEdgeIntersection(
      oc,
      labels,
      target(0),
      mockShape('current-body', [current]),
    );

    expect(result.selected).toEqual([current]);
  });
});

/**
 * Handles target in the topology flow.
 */
function target(index: number | undefined): ResolvedSelectionTarget {
  return {
    id: 'body:edge-intersection:body.(first, second)',
    label: 'body.(first, second)',
    ownerEntity: 'body',
    selectorKind: 'edge-intersection',
    topologyKind: 'edge',
    edgeIntersection: {
      edgeLabels: ['body.first', 'body.second'],
      ...(index === undefined ? {} : { index }),
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
