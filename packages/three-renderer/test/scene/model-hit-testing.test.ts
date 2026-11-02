/**
 * @author Aidan Boissonneault
 * @file model-hit-testing.test.ts
 * @purpose Tests model hit testing behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { InteractionSnapshot } from '@bushscad/ir';
import { resolveModelIntersection } from '../../src/scene/model-hit-testing.js';

const snapshot: InteractionSnapshot = {
  version: 1,
  entrypoint: 'part.bscd',
  entities: [],
  effects: [],
  references: [],
  topology: [
    {
      meshIndex: 3,
      partEntityId: 'part',
      objectEntityId: 'body',
      faces: [
        {
          id: 'face-a',
          ownerEntityId: 'body',
          semanticTargetIds: ['top'],
          triangleStart: 0,
          triangleCount: 2,
        },
        {
          id: 'face-b',
          ownerEntityId: 'body',
          semanticTargetIds: ['side'],
          triangleStart: 2,
          triangleCount: 1,
        },
      ],
      edges: [],
      corners: [],
    },
  ],
};

describe('model hit provenance', () => {
  it('resolves triangle range boundaries to the exact semantic face', () => {
    expect(
      resolveModelIntersection(intersection(1, 3), snapshot),
    ).toMatchObject({
      topologyId: 'face-a',
      meshIndex: 3,
      objectEntityId: 'body',
    });
    expect(
      resolveModelIntersection(intersection(2, 3), snapshot),
    ).toMatchObject({
      topologyId: 'face-b',
    });
  });

  it('rejects helpers and render-only meshes without compiler mesh identity', () => {
    expect(
      resolveModelIntersection(intersection(0, null), snapshot),
    ).toBeNull();
    expect(resolveModelIntersection(intersection(0, 99), snapshot)).toBeNull();
  });

  it('resolves a visible sketch overlay to its exact evaluated instance', () => {
    const group = new THREE.Group();
    group.userData.interactionSketchInstanceId = 'sketch-instance';
    const line = new THREE.LineSegments();
    group.add(line);
    const sketchSnapshot: InteractionSnapshot = {
      ...snapshot,
      sketchDefinitions: [
        {
          id: 'sketch-definition',
          entityIds: ['sketch-entity'],
          name: 'profile',
          sourceSpan: { file: 'part.bscd', line: 2, col: 3 },
          revision: 1,
          primitive: { kind: 'circle', diameter: 4 },
        },
      ],
      sketchInstances: [
        {
          id: 'sketch-instance',
          definitionId: 'sketch-definition',
          entityIds: ['sketch-entity'],
          partEntityId: 'part',
          partName: 'plate',
          sourceSpan: { file: 'part.bscd', line: 3, col: 3 },
          placement: null,
          workplane: 'XY',
          unsupportedReason: 'Wrapped placement is unsupported.',
        },
      ],
    };

    expect(
      resolveModelIntersection(
        {
          distance: 1,
          object: line,
          point: new THREE.Vector3(2, 3, 4),
        } as THREE.Intersection,
        sketchSnapshot,
      ),
    ).toMatchObject({
      topologyId: 'sketch-instance',
      ownerEntityId: 'sketch-entity',
      unsupportedReason: 'Wrapped placement is unsupported.',
    });
  });
});

/**
 * Handles intersection in the scene flow.
 */
function intersection(
  faceIndex: number,
  meshIndex: number | null,
): THREE.Intersection {
  const object = new THREE.Mesh();
  if (meshIndex !== null) object.userData.interactionMeshIndex = meshIndex;
  return {
    distance: 1,
    point: new THREE.Vector3(1, 2, 3),
    object,
    faceIndex,
  } as THREE.Intersection;
}
