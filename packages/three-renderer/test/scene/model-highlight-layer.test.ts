/**
 * @author Aidan Boissonneault
 * @file model-highlight-layer.test.ts
 * @purpose Tests model highlight layer behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { InteractionSnapshot } from '@bushscad/ir';
import { ModelHighlightLayer } from '../../src/scene/model-highlight-layer.js';

describe('model highlight layer', () => {
  it('keeps materials untouched and claims overlapping channels once', () => {
    const material = new THREE.MeshBasicMaterial({ color: '#123456' });
    const mesh = modelMesh(material);
    const layer = new ModelHighlightLayer();
    layer.setViewportSize(800, 600);
    layer.setMeshes([mesh]);
    layer.setSnapshot(snapshot());
    layer.setChannels({
      pinned: ['face-a'],
      'viewport-hover': ['face-a'],
    });

    expect(mesh.material).toBe(material);
    expect(highlightGroups(mesh)).toHaveLength(1);
    expect(highlightGroups(mesh)[0]?.children).toHaveLength(3);
    const overlay = highlightGroups(mesh)[0]!;
    const overlayMesh = overlay.children[0] as THREE.Mesh;
    const sourceDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(
      overlayMesh.material as THREE.Material,
      'dispose',
    );

    layer.setChannels({});
    expect(highlightGroups(mesh)).toEqual([]);
    expect(mesh.material).toBe(material);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(materialDispose).toHaveBeenCalledOnce();
    layer.dispose();
  });

  it('keeps unrelated channels visible and follows parent transforms in bounds', () => {
    const root = new THREE.Group();
    root.position.set(20, 0, 0);
    const mesh = modelMesh(new THREE.MeshBasicMaterial());
    root.add(mesh);
    const layer = new ModelHighlightLayer();
    layer.setMeshes([mesh]);
    layer.setSnapshot(snapshot());
    layer.setChannels({ pinned: ['face-a'], 'source-hover': ['edge-a'] });

    expect(highlightGroups(mesh)).toHaveLength(2);
    const bounds = layer.boundsForTargets(['face-a']);
    expect(bounds?.min.x).toBe(20);
    expect(bounds?.max.x).toBe(21);
    layer.dispose();
  });

  it('renders a face-point as a larger accent without exposing it for the whole object', () => {
    const mesh = modelMesh(new THREE.MeshBasicMaterial());
    const layer = new ModelHighlightLayer();
    layer.setMeshes([mesh]);
    layer.setSnapshot(snapshot());
    layer.setChannels({ 'source-hover': ['point-selector'] });

    const point = highlightGroups(mesh)[0]?.children.find(
      (child): child is THREE.Points => child instanceof THREE.Points,
    );
    expect(point).toBeDefined();
    expect((point!.material as THREE.PointsMaterial).color.getHexString()).toBe(
      'ef4444',
    );
    expect((point!.material as THREE.PointsMaterial).size).toBe(11);

    layer.setChannels({ 'viewport-hover': ['body'] });
    expect(
      highlightGroups(mesh)[0]?.children.some(
        (child) => child instanceof THREE.Points,
      ),
    ).toBe(false);
    layer.dispose();
  });
});

/**
 * Handles model mesh in the scene flow.
 */
function modelMesh(material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3),
  );
  geometry.setIndex([0, 1, 2]);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.interactionMeshIndex = 0;
  return mesh;
}

/**
 * Handles highlight groups in the scene flow.
 */
function highlightGroups(mesh: THREE.Mesh): THREE.Group[] {
  return mesh.children.filter(
    (child): child is THREE.Group => child instanceof THREE.Group,
  );
}

/**
 * Handles snapshot in the scene flow.
 */
function snapshot(): InteractionSnapshot {
  return {
    version: 1,
    entrypoint: 'part.bscd',
    entities: [],
    effects: [],
    references: [],
    topology: [
      {
        meshIndex: 0,
        partEntityId: 'part',
        objectEntityId: 'body',
        faces: [
          {
            id: 'face-a',
            ownerEntityId: 'body',
            semanticTargetIds: ['top', 'point-selector'],
            triangleStart: 0,
            triangleCount: 1,
          },
        ],
        edges: [
          {
            id: 'edge-a',
            ownerEntityId: 'body',
            semanticTargetIds: ['rim'],
            points: [0, 0, 0, 1, 0, 0],
          },
        ],
        corners: [
          {
            id: 'reference-center',
            ownerEntityId: 'body',
            semanticTargetIds: ['point-selector'],
            point: [0.5, 0.5, 0],
            role: 'reference-point',
          },
        ],
      },
    ],
  };
}
