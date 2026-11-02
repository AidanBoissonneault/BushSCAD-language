/**
 * @author Aidan Boissonneault
 * @file world-grid-measurements.ts
 * @purpose Creates unit-aware coordinate labels for the infinite world grid.
 * @last-edited October 30, 2026
 */

import * as THREE from 'three';
import type { WorldGridBounds } from './infinite-world-grid.js';

export type WorldGridUnit = 'mm' | 'in';

/** Formats an internal millimeter coordinate in the selected display unit. */
export function formatWorldGridMeasurement(
  millimeters: number,
  unit: WorldGridUnit,
): string {
  const value = unit === 'in' ? millimeters / 25.4 : millimeters;
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${text} ${unit}`;
}

/** Creates billboard labels along the current view's X and Y measurement lines. */
export function createWorldGridMeasurements(
  bounds: WorldGridBounds,
  target: THREE.Vector3,
  majorInterval: number,
  unit: WorldGridUnit,
  worldUnitsPerPixel: number,
  opacity: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'world-grid-measurements';
  if (typeof document === 'undefined') return group;

  const labelSpacing = measurementSpacing(bounds, majorInterval);
  const labelLineX = snapToInterval(target.x, majorInterval);
  const labelLineY = snapToInterval(target.y, majorInterval);
  const labelHeight = Math.max(worldUnitsPerPixel * 28, majorInterval * 0.22);

  for (const coordinate of coordinates(bounds.minX, bounds.maxX, labelSpacing)) {
    const label = makeCoordinateLabel(
      `X ${formatWorldGridMeasurement(coordinate, unit)}`,
      labelHeight,
      opacity,
    );
    label.position.set(coordinate, labelLineY, 0.22);
    label.name = `world-grid-measurement-x-${coordinate}`;
    group.add(label);
  }

  for (const coordinate of coordinates(bounds.minY, bounds.maxY, labelSpacing)) {
    const label = makeCoordinateLabel(
      `Y ${formatWorldGridMeasurement(coordinate, unit)}`,
      labelHeight,
      opacity,
    );
    label.position.set(labelLineX, coordinate, 0.22);
    label.name = `world-grid-measurement-y-${coordinate}`;
    group.add(label);
  }
  return group;
}

/** Releases textures and materials owned by a measurement-label group. */
export function disposeWorldGridMeasurements(group: THREE.Group): void {
  for (const child of group.children) {
    if (!(child instanceof THREE.Sprite)) continue;
    const material = child.material;
    material.map?.dispose();
    material.dispose();
  }
  group.clear();
}

/** Creates a readable screen-facing coordinate badge at a world-scaled size. */
function makeCoordinateLabel(
  text: string,
  height: number,
  opacity: number,
): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const context = canvas.getContext('2d')!;
  context.fillStyle = 'rgba(250, 249, 246, 0.9)';
  context.strokeStyle = 'rgba(58, 67, 74, 0.42)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(2, 2, 252, 60, 12);
  context.fill();
  context.stroke();
  context.font = '600 25px Segoe UI, system-ui, sans-serif';
  context.fillStyle = '#343b40';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 128, 33, 232);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((height * canvas.width) / canvas.height, height, 1);
  return sprite;
}

/** Chooses a label interval that leaves room for readable measurements. */
function measurementSpacing(
  bounds: WorldGridBounds,
  majorInterval: number,
): number {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxY - bounds.minY;
  const desired = Math.max(width, depth) / 14;
  return majorInterval * Math.max(1, Math.ceil(desired / majorInterval));
}

/** Returns exact world coordinates at a positive interval. */
function coordinates(min: number, max: number, interval: number): number[] {
  const firstIndex = Math.ceil(min / interval);
  const lastIndex = Math.floor(max / interval);
  const values: number[] = [];
  for (let index = firstIndex; index <= lastIndex; index += 1) {
    values.push(Math.round(index * interval * 1e6) / 1e6);
  }
  return values;
}

/** Keeps measurement labels aligned to exact major world-grid divisions. */
function snapToInterval(value: number, interval: number): number {
  return Math.round(value / interval) * interval;
}
