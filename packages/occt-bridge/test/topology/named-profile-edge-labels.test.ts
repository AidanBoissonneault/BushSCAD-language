/**
 * @author Aidan Boissonneault
 * @file named-profile-edge-labels.test.ts
 * @purpose Tests named profile edge labels behavior in the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IRAlignShape, IRProfileSegment } from '@bushscad/ir';
import { FaceLabelMap } from '../../src/topology/face-labels.js';
import { buildAlignShapeOperation } from '../../src/operations/imported-ref-shapes.js';
import { filterEdgesForExtrudedProfileSegment } from '../../src/topology/named-face-edge-labels.js';
import {
  makeMockOC,
  minimalState,
  mockEdge,
  mockShape,
  SPAN,
} from '../fixtures/topology-mocks.js';

describe('named profile edge labels', () => {
  it('copies source named face edges onto alignShape instance edges', () => {
    const sourceCrown = mockEdge('source-crown', [0, 0, 0], [10, 0, 0]);
    const movedSeed = mockEdge('moved-seed', [5, 0, 0], [15, 0, 0]);
    const instanceCrown = mockEdge('instance-crown', [5, 0, 0], [15, 0, 0]);
    const instanceOther = mockEdge('instance-other', [0, 5, 0], [10, 5, 0]);
    const sourceShape = mockShape('body-source', [sourceCrown]);
    const instanceShape = mockShape('body-instance', [
      instanceCrown,
      instanceOther,
    ]);
    const transforms = new Map<unknown, unknown>([
      [sourceShape, instanceShape],
      [sourceCrown, movedSeed],
    ]);
    const oc = makeMockOC(transforms);
    const labelMap = new FaceLabelMap();
    const state = minimalState(labelMap);
    state.bodyShapes.set('body', sourceShape);
    state.bodyFrames.set('body', { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
    labelMap.register(oc, 'body', sourceShape);
    labelMap.registerNamedFaceEdges('body', 'crown', [sourceCrown]);

    const op: IRAlignShape = {
      kind: 'alignShape',
      name: 'body',
      instanceName: 'body_0',
      sourceRef: null,
      targetPlacement: { faceRef: '0,0,0' },
      span: SPAN,
    };
    buildAlignShapeOperation(oc, state, op);

    expect(labelMap.resolveEdges(oc, 'body_0.face.crown.edges')).toEqual([
      instanceCrown,
    ]);
  });

  it('keeps transformed source edges when instance edge matching has no endpoint match', () => {
    const sourceCrown = mockEdge('source-crown', [0, 0, 0], [10, 0, 0]);
    const movedSeed = mockEdge('moved-seed', [5, 0, 0], [15, 0, 0]);
    const instanceOther = mockEdge('instance-other', [0, 5, 0], [10, 5, 0]);
    const sourceShape = mockShape('body-source', [sourceCrown]);
    const instanceShape = mockShape('body-instance', [instanceOther]);
    const transforms = new Map<unknown, unknown>([
      [sourceShape, instanceShape],
      [sourceCrown, movedSeed],
    ]);
    const oc = makeMockOC(transforms);
    const labelMap = new FaceLabelMap();
    const state = minimalState(labelMap);
    state.bodyShapes.set('body', sourceShape);
    state.bodyFrames.set('body', { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] });
    labelMap.register(oc, 'body', sourceShape);
    labelMap.registerNamedFaceEdges('body', 'crown', [sourceCrown]);

    buildAlignShapeOperation(oc, state, {
      kind: 'alignShape',
      name: 'body',
      instanceName: 'body_0',
      sourceRef: null,
      targetPlacement: { faceRef: '0,0,0' },
      span: SPAN,
    });

    expect(labelMap.resolveEdges(oc, 'body_0.face.crown.edges')).toEqual([
      movedSeed,
    ]);
  });

  it('filters extruded profile segment labels to edges touching that segment', () => {
    const crownEdge = mockEdge('crown-edge', [10, 5, 0], [5, 8, 0]);
    const crownVertical = mockEdge('crown-vertical', [10, 5, 0], [10, 5, 4]);
    const adjacentSideEdge = mockEdge(
      'adjacent-side-edge',
      [10, 5, 0],
      [10, 0, 0],
    );
    const otherEdge = mockEdge('other-edge', [0, 0, 0], [10, 0, 0]);
    const oc = makeMockOC();
    const segment: IRProfileSegment = {
      kind: 'arc',
      name: 'crown',
      from: [10, 5],
      to: [5, 8],
      radius: 6,
      clockwise: false,
    };

    const filtered = filterEdgesForExtrudedProfileSegment(
      oc,
      [crownEdge, crownVertical, adjacentSideEdge, otherEdge],
      segment,
      { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    );

    expect(filtered).toEqual([crownEdge, crownVertical]);
  });

  it('tracks vertical crossing edges at the interior of curved segments', () => {
    const crossing = mockEdge('crossing', [0, -5, 0], [0, -5, 4]);
    const oppositeArc = mockEdge('opposite-arc', [0, 5, 0], [0, 5, 4]);
    const segment: IRProfileSegment = {
      kind: 'arc',
      name: 'lower_arc',
      from: [-5, 0],
      to: [5, 0],
      radius: 5,
      clockwise: false,
    };

    const filtered = filterEdgesForExtrudedProfileSegment(
      makeMockOC(),
      [crossing, oppositeArc],
      segment,
      { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] },
    );

    expect(filtered).toEqual([crossing]);
  });
});
