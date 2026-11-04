import * as THREE from 'three';
import { compactSketchNumber } from '@bushscad/ir';
import { SKETCH_SHAPE_COLOR } from '../../sketch-preview-theme.js';
import { drawBoundsDimensions } from '../../sketch-preview-dimensions.js';
import { lineSegs } from '../../sketch-preview-labels.js';

/**
 * Draws an ellipse outline and its width/height labels.
 *
 * Why:
 * Ellipse sampling is independent of the polygon and circle preview rules.
 */
export function drawEllipse(
  content: THREE.Group,
  width: number,
  height: number,
  viewHalf: number,
): void {
  const radiusX = width / 2;
  const radiusY = height / 2;
  const points: number[] = [];
  for (let index = 0; index < 96; index++) {
    const start = (index / 96) * Math.PI * 2;
    const end = ((index + 1) / 96) * Math.PI * 2;
    points.push(
      Math.cos(start) * radiusX,
      Math.sin(start) * radiusY,
      0,
      Math.cos(end) * radiusX,
      Math.sin(end) * radiusY,
      0,
    );
  }
  content.add(lineSegs(points, SKETCH_SHAPE_COLOR));
  drawBoundsDimensions(
    content,
    viewHalf,
    -radiusX,
    radiusX,
    -radiusY,
    radiusY,
    compactSketchNumber(width),
    compactSketchNumber(height),
  );
}
