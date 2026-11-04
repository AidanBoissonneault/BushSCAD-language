import * as THREE from 'three';
import { compactSketchNumber } from '@bushscad/ir';
import { SKETCH_SHAPE_COLOR } from '../../sketch-preview-theme.js';
import { drawBoundsDimensions } from '../../sketch-preview-dimensions.js';
import { lineSegs } from '../../sketch-preview-labels.js';

/**
 * Draws the centered-base triangle outline and its width/height labels.
 *
 * Why:
 * Triangle previews use their own base and height contract from the IR node.
 */
export function drawTriangle(
  content: THREE.Group,
  base: number,
  height: number,
  viewHalf: number,
): void {
  const halfBase = base / 2;
  content.add(
    lineSegs(
      [
        -halfBase,
        0,
        0,
        halfBase,
        0,
        0,
        halfBase,
        0,
        0,
        0,
        height,
        0,
        0,
        height,
        0,
        -halfBase,
        0,
        0,
      ],
      SKETCH_SHAPE_COLOR,
    ),
  );
  drawBoundsDimensions(
    content,
    viewHalf,
    -halfBase,
    halfBase,
    0,
    height,
    compactSketchNumber(base),
    compactSketchNumber(height),
  );
}
