/**
 * @author Aidan Boissonneault
 * @file highlight-geometry.test.ts
 * @purpose Tests highlight geometry behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { InteractionMeshTopology } from '@bushscad/ir';
import {
  cornerPositions,
  createFaceHighlightGeometry,
  edgeSegmentPositions,
  includeHighlightBounds,
  selectHighlightTopology,
} from '../../src/scene/highlight-geometry.js';

const topology: InteractionMeshTopology = {
  meshIndex: 0,
  partEntityId: 'part',
  objectEntityId: 'body',
  faces: [
    {
      id: 'face-a',
      ownerEntityId: 'body',
      semanticTargetIds: ['top'],
      triangleStart: 0,
      triangleCount: 1,
    },
    {
      id: 'face-b',
      ownerEntityId: 'body',
      semanticTargetIds: ['side'],
      triangleStart: 1,
      triangleCount: 1,
    },
  ],
  edges: [
    {
      id: 'edge-a',
      ownerEntityId: 'body',
      semanticTargetIds: ['rim'],
      points: [0, 0, 0, 1, 0, 0, 1, 1, 0],
    },
  ],
  corners: [
    {
      id: 'corner-a',
      ownerEntityId: 'body',
      semanticTargetIds: ['tip'],
      point: [1, 1, 0],
    },
    {
      id: 'reference-center',
      ownerEntityId: 'body',
      semanticTargetIds: ['center-selector'],
      point: [0.5, 0.5, 0],
      role: 'reference-point',
    },
  ],
};

describe('highlight geometry', () => {
  it('resolves exact and semantic targets without broadening a face selection', () => {
    const face = selectHighlightTopology(topology, new Set(['top']));
    expect(face.faces.map((item) => item.id)).toEqual(['face-a']);
    expect(face.edges).toEqual([]);
    expect(face.wholeMesh).toBe(false);

    const whole = selectHighlightTopology(topology, new Set(['body']));
    expect(whole.faces).toHaveLength(2);
    expect(whole.edges).toHaveLength(1);
    expect(whole.corners).toHaveLength(1);
    expect(whole.wholeMesh).toBe(true);

    const point = selectHighlightTopology(
      topology,
      new Set(['center-selector']),
    );
    expect(point.corners.map((item) => item.id)).toEqual(['reference-center']);
  });

  it('deduplicates overlapping face ranges, polylines, and points', () => {
    const geometry = createFaceHighlightGeometry(sourceGeometry(), [
      topology.faces[0]!,
      topology.faces[0]!,
    ]);
    expect(geometry?.getAttribute('position').count).toBe(3);
    expect(
      edgeSegmentPositions([topology.edges[0]!, topology.edges[0]!]),
    ).toHaveLength(12);
    expect(
      cornerPositions([topology.corners[0]!, topology.corners[0]!]),
    ).toHaveLength(3);
  });

  it('computes selected bounds through the live scene transform', () => {
    const mesh = new THREE.Mesh(sourceGeometry());
    mesh.position.set(10, -4, 2);
    const bounds = new THREE.Box3();
    includeHighlightBounds(
      bounds,
      mesh,
      selectHighlightTopology(topology, new Set(['top'])),
    );
    expect(bounds.min.toArray()).toEqual([10, -4, 2]);
    expect(bounds.max.toArray()).toEqual([11, -3, 2]);
  });
});

/**
 * Returns the source data required by the current operation.
 */
function sourceGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}
