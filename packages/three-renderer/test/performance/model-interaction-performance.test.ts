/**
 * @author Aidan Boissonneault
 * @file model-interaction-performance.test.ts
 * @purpose Tests model interaction performance behavior in the performance in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { InteractionSnapshot } from '@bushscad/ir';
import { ModelHighlightLayer } from '../../src/scene/model-highlight-layer.js';
import { hitTestModel } from '../../src/scene/model-hit-testing.js';

const HOVER_BUDGET_MS = 16.7;
const OVERLAY_CYCLE_BUDGET_MS = 40;
const MODEL_SIZES = [
  ['small', 30],
  ['large', 3_000],
] as const;

describe('large model interaction performance', () => {
  it.each(MODEL_SIZES)(
    'keeps %s-model raycast hover inside one frame after data is ready',
    (_label, triangleCount) => {
      const mesh = modelMesh(triangleCount);
      const camera = cameraForMesh();
      const raycaster = new THREE.Raycaster();
      const snapshot = modelSnapshot(triangleCount);
      const canvas = fakeCanvas();
      const samples: number[] = [];

      for (let index = 0; index < 12; index++) {
        const started = performance.now();
        expect(
          hitTestModel(raycaster, camera, canvas, 50, 50, [mesh], snapshot),
        ).not.toBeNull();
        samples.push(performance.now() - started);
      }

      const steadyState = samples.slice(2);
      const average =
        steadyState.reduce((total, value) => total + value, 0) /
        steadyState.length;
      expect(
        average,
        `average raycast was ${average.toFixed(2)} ms`,
      ).toBeLessThan(HOVER_BUDGET_MS);
    },
  );

  it.each(MODEL_SIZES)(
    'stabilizes %s-model overlays across rebuild and disposal cycles',
    (_label, triangleCount) => {
      const mesh = modelMesh(triangleCount);
      const layer = new ModelHighlightLayer();
      layer.setMeshes([mesh]);
      layer.setSnapshot(modelSnapshot(triangleCount));
      const sourceDispose = vi.spyOn(mesh.geometry, 'dispose');
      layer.setChannels({ 'source-hover': ['body'] });
      layer.setChannels({});
      const started = performance.now();
      let maximumChildren = 0;

      for (let index = 0; index < 10; index++) {
        layer.setChannels({ 'source-hover': ['body'] });
        maximumChildren = Math.max(maximumChildren, mesh.children.length);
        const overlay = mesh.children[0] as THREE.Group;
        const material = (overlay.children[0] as THREE.Mesh)
          .material as THREE.Material;
        const dispose = vi.spyOn(material, 'dispose');
        layer.setChannels({});
        expect(dispose).toHaveBeenCalledOnce();
        expect(mesh.children).toHaveLength(0);
      }

      const rebuildMs = performance.now() - started;
      const averageRebuildMs = rebuildMs / 10;
      expect(maximumChildren).toBe(1);
      expect(
        averageRebuildMs,
        `overlay cycles averaged ${averageRebuildMs.toFixed(1)} ms`,
      ).toBeLessThan(OVERLAY_CYCLE_BUDGET_MS);
      expect(sourceDispose).not.toHaveBeenCalled();
      layer.dispose();
      expect(mesh.children).toHaveLength(0);
    },
  );
});

/**
 * Handles model mesh in the performance flow.
 */
function modelMesh(triangleCount: number): THREE.Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index < triangleCount; index++) {
    const base = positions.length / 3;
    const offset = (index % 20) * 0.0001;
    positions.push(-1 + offset, -1, 0, 1, -1 + offset, 0, 0, 1, 0);
    normals.push(0, 0, 1, 0, 0, 1, 0, 0, 1);
    indices.push(base, base + 1, base + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.userData.interactionMeshIndex = 0;
  return mesh;
}

/**
 * Handles camera for mesh in the performance flow.
 */
function cameraForMesh(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

/**
 * Handles fake canvas in the performance flow.
 */
function fakeCanvas(): HTMLCanvasElement {
  return {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
    }),
  } as unknown as HTMLCanvasElement;
}

/**
 * Handles model snapshot in the performance flow.
 */
function modelSnapshot(triangleCount: number): InteractionSnapshot {
  const span = { file: 'large.bscd', line: 1, col: 1 };
  return {
    version: 1,
    entrypoint: span.file,
    entities: [
      {
        id: 'part',
        kind: 'part',
        name: 'part',
        declarationSpan: span,
        effectIds: [],
        rendered: true,
      },
      {
        id: 'body',
        kind: 'object',
        name: 'body',
        ownerId: 'part',
        declarationSpan: span,
        effectIds: [],
        rendered: true,
      },
    ],
    effects: [],
    references: [],
    topology: [
      {
        meshIndex: 0,
        partEntityId: 'part',
        objectEntityId: 'body',
        faces: [
          {
            id: 'body-face',
            ownerEntityId: 'body',
            semanticTargetIds: [],
            triangleStart: 0,
            triangleCount,
          },
        ],
        edges: [],
        corners: [],
      },
    ],
  };
}
