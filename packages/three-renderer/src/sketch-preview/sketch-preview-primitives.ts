/**
 * @author Aidan Boissonneault
 * @file sketch-preview-primitives.ts
 * @purpose Provides sketch preview primitives behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive } from '@bushscad/ir';
import { compactSketchNumber, sketchBoundsFromPoints } from '@bushscad/ir';
import {
  SKETCH_DIM_COLOR,
  SKETCH_SHAPE_COLOR,
} from './sketch-preview-theme.js';
import { drawBoundsDimensions } from './sketch-preview-dimensions.js';
import { labelSprite, lineSegs } from './sketch-preview-labels.js';

/**
 * Handles draw primitive in the sketch preview flow.
 */
export function drawPrimitive(
  content: THREE.Group,
  primitive: Exclude<
    IRPrimitive,
    { kind: 'profile' | 'word' | 'sketchBoolean' | 'sketchAt' | 'sketchRef' }
  >,
  viewHalf: number,
): void {
  switch (primitive.kind) {
    case 'rect':
      drawRect(content, primitive.width, primitive.height, viewHalf);
      break;
    case 'roundrect':
      drawRoundRect(
        content,
        primitive.width,
        primitive.height,
        primitive.radius,
        viewHalf,
      );
      break;
    case 'circle':
      drawCircle(content, primitive.diameter, viewHalf);
      break;
    case 'ellipse':
      drawEllipse(content, primitive.width, primitive.height, viewHalf);
      break;
    case 'triangle':
      drawTriangle(content, primitive.base, primitive.height, viewHalf);
      break;
    case 'polygon':
      drawPolygon(content, primitive.points, viewHalf);
      break;
  }
}

/**
 * Handles draw ellipse in the sketch preview flow.
 */
function drawEllipse(
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

/**
 * Handles draw rect in the sketch preview flow.
 */
function drawRect(
  content: THREE.Group,
  w: number,
  h: number,
  viewHalf: number,
): void {
  const hw = w / 2;
  const hh = h / 2;
  content.add(
    lineSegs(
      [
        -hw,
        -hh,
        0,
        hw,
        -hh,
        0,
        hw,
        -hh,
        0,
        hw,
        hh,
        0,
        hw,
        hh,
        0,
        -hw,
        hh,
        0,
        -hw,
        hh,
        0,
        -hw,
        -hh,
        0,
      ],
      SKETCH_SHAPE_COLOR,
    ),
  );
  drawBoundsDimensions(
    content,
    viewHalf,
    -hw,
    hw,
    -hh,
    hh,
    compactSketchNumber(w),
    compactSketchNumber(h),
  );
}

/**
 * Handles draw round rect in the sketch preview flow.
 */
function drawRoundRect(
  content: THREE.Group,
  w: number,
  h: number,
  r: number,
  viewHalf: number,
): void {
  const hw = w / 2;
  const hh = h / 2;
  const radius = Math.min(r, hw, hh);
  const segs = 10;
  const corners = [
    { cx: hw - radius, cy: hh - radius, start: 0 },
    { cx: -hw + radius, cy: hh - radius, start: Math.PI / 2 },
    { cx: -hw + radius, cy: -hh + radius, start: Math.PI },
    { cx: hw - radius, cy: -hh + radius, start: Math.PI * 1.5 },
  ];
  const outline: [number, number][] = [];

  for (const corner of corners) {
    for (let i = 0; i <= segs; i++) {
      const a = corner.start + ((i / segs) * Math.PI) / 2;
      outline.push([
        corner.cx + Math.cos(a) * radius,
        corner.cy + Math.sin(a) * radius,
      ]);
    }
  }

  const pts: number[] = [];
  for (let i = 0; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    pts.push(x0, y0, 0, x1, y1, 0);
  }
  content.add(lineSegs(pts, SKETCH_SHAPE_COLOR));
  drawBoundsDimensions(
    content,
    viewHalf,
    -hw,
    hw,
    -hh,
    hh,
    compactSketchNumber(w),
    compactSketchNumber(h),
  );
}

/**
 * Handles draw circle in the sketch preview flow.
 */
function drawCircle(
  content: THREE.Group,
  diameter: number,
  viewHalf: number,
): void {
  const r = diameter / 2;
  const segs = 96;
  const pts: number[] = [];
  for (let i = 0; i < segs; i++) {
    const a0 = (i / segs) * Math.PI * 2;
    const a1 = ((i + 1) / segs) * Math.PI * 2;
    pts.push(
      Math.cos(a0) * r,
      Math.sin(a0) * r,
      0,
      Math.cos(a1) * r,
      Math.sin(a1) * r,
      0,
    );
  }
  content.add(lineSegs(pts, SKETCH_SHAPE_COLOR));
  content.add(
    lineSegs(
      [-r * 0.12, 0, 0, r * 0.12, 0, 0, 0, -r * 0.12, 0, 0, r * 0.12, 0],
      SKETCH_DIM_COLOR,
    ),
  );
  content.add(lineSegs([-r, 0, 0, r, 0, 0], SKETCH_DIM_COLOR));
  const label = labelSprite(
    `dia ${compactSketchNumber(diameter)} mm`,
    viewHalf * 0.58,
    viewHalf * 0.15,
  );
  label.position.set(0, r * 0.28, 0);
  content.add(label);
}

/**
 * Handles draw triangle in the sketch preview flow.
 */
function drawTriangle(
  content: THREE.Group,
  base: number,
  height: number,
  viewHalf: number,
): void {
  const hb = base / 2;
  content.add(
    lineSegs(
      [-hb, 0, 0, hb, 0, 0, hb, 0, 0, 0, height, 0, 0, height, 0, -hb, 0, 0],
      SKETCH_SHAPE_COLOR,
    ),
  );
  drawBoundsDimensions(
    content,
    viewHalf,
    -hb,
    hb,
    0,
    height,
    compactSketchNumber(base),
    compactSketchNumber(height),
  );
}

/**
 * Handles draw polygon in the sketch preview flow.
 */
function drawPolygon(
  content: THREE.Group,
  points: [number, number][],
  viewHalf: number,
): void {
  const b = sketchBoundsFromPoints(points);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const normalized = points.map(
    ([x, y]) => [x - cx, y - cy] as [number, number],
  );
  const pts: number[] = [];

  for (let i = 0; i < normalized.length; i++) {
    const [x0, y0] = normalized[i];
    const [x1, y1] = normalized[(i + 1) % normalized.length];
    pts.push(x0, y0, 0, x1, y1, 0);
  }

  content.add(lineSegs(pts, SKETCH_SHAPE_COLOR));
  drawBoundsDimensions(
    content,
    viewHalf,
    b.minX - cx,
    b.maxX - cx,
    b.minY - cy,
    b.maxY - cy,
    compactSketchNumber(b.width),
    compactSketchNumber(b.height),
  );
}
