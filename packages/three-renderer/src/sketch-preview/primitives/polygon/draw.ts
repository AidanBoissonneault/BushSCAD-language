import * as THREE from 'three';
import { compactSketchNumber, sketchBoundsFromPoints } from '@bushscad/ir';
import { SKETCH_SHAPE_COLOR } from '../../sketch-preview-theme.js';
import { drawBoundsDimensions } from '../../sketch-preview-dimensions.js';
import { lineSegs } from '../../sketch-preview-labels.js';

/**
 * Draws a polygon centered on its bounds with width/height labels.
 *
 * Why:
 * Polygon point normalization is specific to polygon sketch preview rendering.
 */
export function drawPolygon(
  content: THREE.Group,
  points: [number, number][],
  viewHalf: number,
): void {
  const bounds = sketchBoundsFromPoints(points);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const normalized = points.map(
    ([x, y]) => [x - centerX, y - centerY] as [number, number],
  );
  const segments: number[] = [];

  for (let index = 0; index < normalized.length; index++) {
    const [x0, y0] = normalized[index];
    const [x1, y1] = normalized[(index + 1) % normalized.length];
    segments.push(x0, y0, 0, x1, y1, 0);
  }

  content.add(lineSegs(segments, SKETCH_SHAPE_COLOR));
  drawBoundsDimensions(
    content,
    viewHalf,
    bounds.minX - centerX,
    bounds.maxX - centerX,
    bounds.minY - centerY,
    bounds.maxY - centerY,
    compactSketchNumber(bounds.width),
    compactSketchNumber(bounds.height),
  );
}
