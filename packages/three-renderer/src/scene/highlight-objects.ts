/**
 * @author Aidan Boissonneault
 * @file highlight-objects.ts
 * @purpose Provides highlight objects behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/** Creates the translucent emissive surface pass for selected faces. */
export function createFaceHighlightMesh(
  geometry: THREE.BufferGeometry,
  color: string,
  ownsGeometry = true,
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.3,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.highlightOwnsGeometry = ownsGeometry;
  mesh.renderOrder = 20;
  return mesh;
}

/** Adds a faint occluded cue and a strong depth-tested screen-space line. */
export function addHighlightLineCue(
  group: THREE.Group,
  positions: Float32Array,
  color: string,
  width: number,
): void {
  group.add(lineOverlay(positions, color, width + 1, false, 0.16));
  group.add(lineOverlay(positions, color, width));
}

/** Creates fixed-screen-size points for exact topology corners. */
export function createCornerHighlightPoints(
  positions: Float32Array,
  color: string,
  size = 8,
): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color,
    size,
    sizeAttenuation: false,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.renderOrder = 22;
  return points;
}

/** Updates LineMaterial resolution after canvas or device layout changes. */
export function setHighlightLineResolution(
  group: THREE.Group,
  width: number,
  height: number,
): void {
  group.traverse((object) => {
    if (object instanceof LineSegments2) {
      object.material.resolution.set(width, height);
    }
  });
}

/** Releases every GPU object owned by one detached highlight group. */
export function disposeHighlightGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Points ||
      object instanceof LineSegments2
    ) {
      if (object.userData.highlightOwnsGeometry !== false) {
        object.geometry.dispose();
      }
      const material = object.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
  });
  group.clear();
}

/**
 * Creates line geometry from the supplied endpoints.
 */
function lineOverlay(
  positions: Float32Array,
  color: string,
  width: number,
  depthTest = true,
  opacity = 0.95,
): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  const material = new LineMaterial({
    color,
    linewidth: width,
    worldUnits: false,
    transparent: true,
    opacity,
    depthTest,
    depthWrite: false,
  });
  material.resolution.set(1, 1);
  const lines = new LineSegments2(geometry, material);
  lines.renderOrder = depthTest ? 21 : 19;
  return lines;
}
