/**
 * @author Aidan Boissonneault
 * @file sketch-preview-dimensions.ts
 * @purpose Provides sketch preview dimensions behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { SKETCH_DIM_COLOR } from './sketch-preview-theme.js';
import { lineSegs, labelSprite } from './sketch-preview-labels.js';

/**
 * Handles draw bounds dimensions in the sketch preview flow.
 */
export function drawBoundsDimensions(
  content: THREE.Group,
  viewHalf: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  wText: string,
  hText: string,
): void {
  const gap = viewHalf * 0.16;
  const tick = viewHalf * 0.045;
  const lw = viewHalf * 0.52;
  const lh = viewHalf * 0.15;

  const wy = minY - gap;
  content.add(
    lineSegs(
      [
        minX,
        minY,
        0,
        minX,
        wy,
        0,
        maxX,
        minY,
        0,
        maxX,
        wy,
        0,
        minX,
        wy,
        0,
        maxX,
        wy,
        0,
        minX,
        wy - tick,
        0,
        minX,
        wy + tick,
        0,
        maxX,
        wy - tick,
        0,
        maxX,
        wy + tick,
        0,
      ],
      SKETCH_DIM_COLOR,
    ),
  );
  const wLabel = labelSprite(`${wText} mm`, lw, lh);
  wLabel.position.set((minX + maxX) / 2, wy - lh * 0.9, 0);
  content.add(wLabel);

  const hx = maxX + gap;
  content.add(
    lineSegs(
      [
        maxX,
        minY,
        0,
        hx,
        minY,
        0,
        maxX,
        maxY,
        0,
        hx,
        maxY,
        0,
        hx,
        minY,
        0,
        hx,
        maxY,
        0,
        hx - tick,
        minY,
        0,
        hx + tick,
        minY,
        0,
        hx - tick,
        maxY,
        0,
        hx + tick,
        maxY,
        0,
      ],
      SKETCH_DIM_COLOR,
    ),
  );
  const hLabel = labelSprite(`${hText} mm`, lw, lh);
  hLabel.position.set(hx + lw * 0.58, (minY + maxY) / 2, 0);
  content.add(hLabel);
}
