import * as THREE from 'three';
import { compactSketchNumber } from '@bushscad/ir';
import { SKETCH_SHAPE_COLOR } from '../../sketch-preview-theme.js';
import { drawBoundsDimensions } from '../../sketch-preview-dimensions.js';
import { lineSegs } from '../../sketch-preview-labels.js';

/**
 * Draws the centered outline and width/height labels for a rectangle.
 *
 * Why:
 * Rectangle previews have their own dimension behavior and stay isolated from
 * the other primitive renderers.
 */
export function drawRect(
  content: THREE.Group,
  width: number,
  height: number,
  viewHalf: number,
): void {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  content.add(
    lineSegs(
      [
        -halfWidth,
        -halfHeight,
        0,
        halfWidth,
        -halfHeight,
        0,
        halfWidth,
        -halfHeight,
        0,
        halfWidth,
        halfHeight,
        0,
        halfWidth,
        halfHeight,
        0,
        -halfWidth,
        halfHeight,
        0,
        -halfWidth,
        halfHeight,
        0,
        -halfWidth,
        -halfHeight,
        0,
      ],
      SKETCH_SHAPE_COLOR,
    ),
  );
  drawBoundsDimensions(
    content,
    viewHalf,
    -halfWidth,
    halfWidth,
    -halfHeight,
    halfHeight,
    compactSketchNumber(width),
    compactSketchNumber(height),
  );
}
