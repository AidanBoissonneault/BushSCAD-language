/**
 * @author Aidan Boissonneault
 * @file build-volume-guide.ts
 * @purpose Builds printer-bed outline and height ruler geometry for the viewport.
 * @last-edited October 30, 2026
 */

import * as THREE from 'three';

const HEIGHT_GUIDE_COLOR = new THREE.Color('#e2a53a');

/** Builds the configured printer-bed boundary independently from the world grid. */
export function buildVolumeOutlineGeometry(
  width: number,
  depth: number,
): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const positions = [
    -halfWidth,
    -halfDepth,
    0,
    halfWidth,
    -halfDepth,
    0,
    halfWidth,
    -halfDepth,
    0,
    halfWidth,
    halfDepth,
    0,
    halfWidth,
    halfDepth,
    0,
    -halfWidth,
    halfDepth,
    0,
    -halfWidth,
    halfDepth,
    0,
    -halfWidth,
    -halfDepth,
    0,
  ];
  return lineGeometry(positions);
}

/** Builds the optional corner ruler and top outline at the configured height. */
export function heightGuideGeometry(
  width: number,
  depth: number,
  height: number,
  interval: number,
  color = HEIGHT_GUIDE_COLOR,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const x = width / 2;
  const y = depth / 2;
  addSegment(positions, [x, y, 0], [x, y, height]);

  for (let z = interval; z < height; z += interval) {
    const notchLength = interval * (isMajorInterval(z, interval) ? 0.5 : 0.25);
    addSegment(positions, [x, y, z], [x - notchLength, y, z]);
  }

  addSegment(positions, [-x, -y, height], [x, -y, height]);
  addSegment(positions, [x, -y, height], [x, y, height]);
  addSegment(positions, [x, y, height], [-x, y, height]);
  addSegment(positions, [-x, y, height], [-x, -y, height]);
  return lineGeometry(positions, color);
}

/** Adds one independent line segment to a position buffer. */
function addSegment(
  positions: number[],
  start: [number, number, number],
  end: [number, number, number],
): void {
  positions.push(...start, ...end);
}

/** Creates geometry from the supplied line endpoints and optional vertex color. */
function lineGeometry(
  positions: number[],
  color?: THREE.Color,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  if (color) {
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(
        Array.from({ length: positions.length / 3 }, () => [
          color.r,
          color.g,
          color.b,
        ]).flat(),
        3,
      ),
    );
  }
  return geometry;
}

/** Returns whether a ruler mark lies on a five-interval division. */
function isMajorInterval(value: number, interval: number): boolean {
  return (
    Math.abs(value / interval / 5 - Math.round(value / interval / 5)) < 1e-6
  );
}
