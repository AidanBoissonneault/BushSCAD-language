import * as THREE from 'three';
import { compactSketchNumber } from '@bushscad/ir';
import { SKETCH_SHAPE_COLOR } from '../../sketch-preview-theme.js';
import { drawBoundsDimensions } from '../../sketch-preview-dimensions.js';
import { lineSegs } from '../../sketch-preview-labels.js';

/**
 * Draws a rounded rectangle outline and its width/height labels.
 *
 * Why:
 * Corner sampling and radius clamping are specific to the roundrect preview.
 */
export function drawRoundRect(
  content: THREE.Group,
  width: number,
  height: number,
  requestedRadius: number,
  viewHalf: number,
): void {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const radius = Math.min(requestedRadius, halfWidth, halfHeight);
  const segments = 10;
  const corners = [
    { cx: halfWidth - radius, cy: halfHeight - radius, start: 0 },
    {
      cx: -halfWidth + radius,
      cy: halfHeight - radius,
      start: Math.PI / 2,
    },
    { cx: -halfWidth + radius, cy: -halfHeight + radius, start: Math.PI },
    {
      cx: halfWidth - radius,
      cy: -halfHeight + radius,
      start: Math.PI * 1.5,
    },
  ];
  const outline: [number, number][] = [];

  for (const corner of corners) {
    for (let index = 0; index <= segments; index++) {
      const angle = corner.start + ((index / segments) * Math.PI) / 2;
      outline.push([
        corner.cx + Math.cos(angle) * radius,
        corner.cy + Math.sin(angle) * radius,
      ]);
    }
  }

  const points: number[] = [];
  for (let index = 0; index < outline.length; index++) {
    const [x0, y0] = outline[index];
    const [x1, y1] = outline[(index + 1) % outline.length];
    points.push(x0, y0, 0, x1, y1, 0);
  }
  content.add(lineSegs(points, SKETCH_SHAPE_COLOR));
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
