/**
 * @author Aidan Boissonneault
 * @file vector-side-label.ts
 * @purpose Provides vector side label behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import helvetikerBold from 'three/examples/fonts/helvetiker_bold.typeface.json';
import {
  FontLoader,
  type FontData,
} from 'three/examples/jsm/loaders/FontLoader.js';

/**
 * Three.js mesh that draws a vector side label using shape geometry and a basic material.
 */
export type VectorSideLabel = THREE.Mesh<
  THREE.ShapeGeometry,
  THREE.MeshBasicMaterial
>;

const labelFont = new FontLoader().parse(helvetikerBold as unknown as FontData);

/**
 * Creates centered outline geometry for a scene-side title.
 * Font outlines remain sharp at any world scale, unlike the former fixed-size
 * canvas texture. Normalizing width preserves the existing scale calculation.
 */
export function createVectorSideLabel(
  text: string,
  billboard: boolean,
): VectorSideLabel {
  const geometry = normalizedTextGeometry(text);
  const material = new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 1000;
  if (billboard) {
    mesh.onBeforeRender = (_renderer, _scene, camera) => {
      mesh.quaternion.copy(camera.quaternion);
    };
  }
  return mesh;
}

/**
 * Handles normalized text geometry in the scene flow.
 */
function normalizedTextGeometry(text: string): THREE.ShapeGeometry {
  const geometry = new THREE.ShapeGeometry(
    labelFont.generateShapes(text, 1),
    8,
  );
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return geometry;
  const width = Math.max(bounds.max.x - bounds.min.x, Number.EPSILON);
  geometry.translate(
    -(bounds.min.x + bounds.max.x) / 2,
    -(bounds.min.y + bounds.max.y) / 2,
    0,
  );
  geometry.scale(1 / width, 1 / width, 1);
  return geometry;
}
