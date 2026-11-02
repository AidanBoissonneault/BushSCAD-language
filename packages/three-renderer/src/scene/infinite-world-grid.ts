/**
 * @author Aidan Boissonneault
 * @file infinite-world-grid.ts
 * @purpose Builds an origin-aligned ground grid that expands with the camera view.
 * @last-edited October 30, 2026
 */

import * as THREE from 'three';

export type WorldGridBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type WorldGridPalette = {
  minor: THREE.Color;
  major: THREE.Color;
  axis: THREE.Color;
};

const MAX_GROUND_INTERSECTION_DISTANCE = 100_000;
const DEFAULT_MINOR_COLOR = new THREE.Color('#d4cfc8');
const DEFAULT_MAJOR_COLOR = new THREE.Color('#b8b0a0');
const DEFAULT_AXIS_COLOR = new THREE.Color('#8b8171');

/** Creates the line object that will own dynamically expanded world-grid geometry. */
export function createInfiniteWorldGrid(): THREE.LineSegments {
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  lines.name = 'infinite-world-grid-lines';
  lines.renderOrder = -1;
  return lines;
}

/** Replaces the grid geometry with origin-aligned lines inside the visible bounds. */
export function updateInfiniteWorldGrid(
  lines: THREE.LineSegments,
  bounds: WorldGridBounds,
  interval: number,
  palette: WorldGridPalette = {
    minor: DEFAULT_MINOR_COLOR,
    major: DEFAULT_MAJOR_COLOR,
    axis: DEFAULT_AXIS_COLOR,
  },
): void {
  const previous = lines.geometry;
  lines.geometry = infiniteWorldGridGeometry(bounds, interval, palette);
  previous.dispose();
}

/** Creates infinite-style grid lines without any frame or bounded bed edges. */
export function infiniteWorldGridGeometry(
  bounds: WorldGridBounds,
  interval: number,
  palette: WorldGridPalette = {
    minor: DEFAULT_MINOR_COLOR,
    major: DEFAULT_MAJOR_COLOR,
    axis: DEFAULT_AXIS_COLOR,
  },
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const firstX = Math.ceil(bounds.minX / interval);
  const lastX = Math.floor(bounds.maxX / interval);
  const firstY = Math.ceil(bounds.minY / interval);
  const lastY = Math.floor(bounds.maxY / interval);

  for (let index = firstX; index <= lastX; index += 1) {
    const x = cleanCoordinate(index * interval);
    const color = lineColor(index, palette);
    addSegment(positions, colors, [x, bounds.minY, 0], [x, bounds.maxY, 0], color);
  }
  for (let index = firstY; index <= lastY; index += 1) {
    const y = cleanCoordinate(index * interval);
    const color = lineColor(index, palette);
    addSegment(positions, colors, [bounds.minX, y, 0], [bounds.maxX, y, 0], color);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

/** Finds the part of the ground plane visible through the camera frustum. */
export function worldGridViewBounds(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
): WorldGridBounds {
  camera.updateMatrixWorld(true);
  const points: THREE.Vector3[] = [];
  for (const x of [-1, 0, 1]) {
    for (const y of [-1, 0, 1]) {
      const rayPoint = new THREE.Vector3(x, y, 0.5).unproject(camera);
      const direction = rayPoint.sub(camera.position).normalize();
      if (direction.z >= -1e-7) continue;
      const distance = -camera.position.z / direction.z;
      if (
        distance <= 0 ||
        distance > camera.far ||
        distance > MAX_GROUND_INTERSECTION_DISTANCE
      ) {
        continue;
      }
      points.push(camera.position.clone().addScaledVector(direction, distance));
    }
  }

  if (points.length === 0) {
    return {
      minX: target.x - 1000,
      maxX: target.x + 1000,
      minY: target.y - 1000,
      maxY: target.y + 1000,
    };
  }
  points.push(new THREE.Vector3(target.x, target.y, 0));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    maxX: Math.max(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

/** Adds breathing room around camera bounds so the grid edge stays offscreen. */
export function paddedWorldGridBounds(
  bounds: WorldGridBounds,
  interval: number,
): WorldGridBounds {
  const padding = Math.max(
    interval * 10,
    (bounds.maxX - bounds.minX) * 0.2,
    (bounds.maxY - bounds.minY) * 0.2,
    100,
  );
  return {
    minX: Math.floor((bounds.minX - padding) / interval) * interval,
    maxX: Math.ceil((bounds.maxX + padding) / interval) * interval,
    minY: Math.floor((bounds.minY - padding) / interval) * interval,
    maxY: Math.ceil((bounds.maxY + padding) / interval) * interval,
  };
}

/** Selects a readable world interval from camera distance and the user's base unit. */
export function worldGridIntervalForView(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  viewportHeight: number,
  baseInterval: number,
): { interval: number; worldUnitsPerPixel: number } {
  const distance = Math.max(camera.position.distanceTo(target), 1);
  const worldUnitsPerPixel =
    (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) /
    Math.max(viewportHeight, 1);
  const desiredInterval = worldUnitsPerPixel * 24;
  const multiplier = niceCeiling(Math.max(1, desiredInterval / baseInterval));
  return {
    interval: baseInterval * multiplier,
    worldUnitsPerPixel,
  };
}

/** Returns a 1-2-5 interval multiplier rounded up to the requested scale. */
function niceCeiling(value: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const scaled = value / magnitude;
  if (scaled <= 1) return magnitude;
  if (scaled <= 2) return magnitude * 2;
  if (scaled <= 5) return magnitude * 5;
  return magnitude * 10;
}

/** Selects minor, major, or coordinate-axis ink for one grid division. */
function lineColor(index: number, palette: WorldGridPalette): THREE.Color {
  if (index === 0) return palette.axis;
  return index % 5 === 0 ? palette.major : palette.minor;
}

/** Adds an independently colored line segment to the geometry buffers. */
function addSegment(
  positions: number[],
  colors: number[],
  start: [number, number, number],
  end: [number, number, number],
  color: THREE.Color,
): void {
  positions.push(...start, ...end);
  colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
}

/** Removes floating point noise from division-aligned world coordinates. */
function cleanCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
