import * as THREE from 'three';
import { compactSketchNumber } from '@bushscad/ir';
import {
  SKETCH_DIM_COLOR,
  SKETCH_SHAPE_COLOR,
} from '../../sketch-preview-theme.js';
import { lineSegs, labelSprite } from '../../sketch-preview-labels.js';

/**
 * Draws the circle outline, diameter guides, and diameter label.
 *
 * Why:
 * Circle previews use a diameter callout rather than rectangular bounds.
 */
export function drawCircle(
  content: THREE.Group,
  diameter: number,
  viewHalf: number,
): void {
  const radius = diameter / 2;
  const segments = 96;
  const points: number[] = [];
  for (let index = 0; index < segments; index++) {
    const start = (index / segments) * Math.PI * 2;
    const end = ((index + 1) / segments) * Math.PI * 2;
    points.push(
      Math.cos(start) * radius,
      Math.sin(start) * radius,
      0,
      Math.cos(end) * radius,
      Math.sin(end) * radius,
      0,
    );
  }
  content.add(lineSegs(points, SKETCH_SHAPE_COLOR));
  content.add(
    lineSegs(
      [
        -radius * 0.12,
        0,
        0,
        radius * 0.12,
        0,
        0,
        0,
        -radius * 0.12,
        0,
        0,
        radius * 0.12,
        0,
      ],
      SKETCH_DIM_COLOR,
    ),
  );
  content.add(lineSegs([-radius, 0, 0, radius, 0, 0], SKETCH_DIM_COLOR));
  const label = labelSprite(
    `dia ${compactSketchNumber(diameter)} mm`,
    viewHalf * 0.58,
    viewHalf * 0.15,
  );
  label.position.set(0, radius * 0.28, 0);
  content.add(label);
}
