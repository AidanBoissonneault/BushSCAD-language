/**
 * @author Aidan Boissonneault
 * @file sketch-preview-profiles.ts
 * @purpose Provides sketch preview profiles behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive, SketchPreviewModel } from '@bushscad/ir';
import { profileStatusText } from './sketch-preview-profile-status.js';
import {
  compactSketchNumber,
  sketchArcPolyline,
  sketchBoundsFromPoints,
  sketchEllipsePolyline,
  sketchSegmentsToLinePoints,
} from '@bushscad/ir';
import {
  SKETCH_DETAIL_COLOR,
  SKETCH_SHAPE_COLOR,
} from './sketch-preview-theme.js';
import { drawBoundsDimensions } from './sketch-preview-dimensions.js';
import { labelSprite, lineSegs } from './sketch-preview-labels.js';

// Constraint overlay colors
const CONSTRAINT_UNDER_COLOR = 0x2563eb; // blue — underconstrained
const CONSTRAINT_ERROR_COLOR = 0xdc2626; // red — no-convergence

/**
 * The profile variant of an IR primitive, used where sketch-preview code needs profile-specific
 * geometry.
 */
type ProfilePrimitive = Extract<IRPrimitive, { kind: 'profile' }>;

/**
 * Handles draw profile in the sketch preview flow.
 */
export function drawProfile(
  content: THREE.Group,
  primitive: ProfilePrimitive,
  preview: SketchPreviewModel,
  viewHalf: number,
): void {
  const b = sketchBoundsFromPoints(profilePoints(primitive));
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;

  drawProfileSegments(content, primitive, cx, cy, viewHalf);
  drawProfileBounds(content, viewHalf, b, cx, cy);

  // Constraint status label
  const statusText = profileStatusText(
    preview.isClosed,
    primitive.constraintState,
  );
  const status = labelSprite(statusText, viewHalf * 0.9, viewHalf * 0.13);
  status.position.set(0, b.maxY - cy + viewHalf * 0.18, 0);
  content.add(status);
}

/**
 * Builds the profile data required by the current operation.
 */
function profilePoints(primitive: ProfilePrimitive): [number, number][] {
  const allPoints: [number, number][] = [];
  for (const segment of primitive.segments) {
    if (segment.kind === 'arc') allPoints.push(...sketchArcPolyline(segment));
    else if (segment.kind === 'ellipse') {
      allPoints.push(...sketchEllipsePolyline(segment));
    } else allPoints.push(segment.from, segment.to);
  }
  return allPoints;
}

/**
 * Handles draw profile segments in the sketch preview flow.
 */
function drawProfileSegments(
  content: THREE.Group,
  primitive: ProfilePrimitive,
  cx: number,
  cy: number,
  viewHalf: number,
): void {
  const color = profileSegmentColor(primitive);
  for (const segment of primitive.segments) {
    const normalized = normalizedSegmentPoints(segment, cx, cy);
    content.add(lineSegs(sketchSegmentsToLinePoints(normalized), color));
    drawSegmentLabel(content, segment, normalized, viewHalf);
  }
}

/**
 * Handles normalized segment points in the sketch preview flow.
 */
function normalizedSegmentPoints(
  segment: ProfilePrimitive['segments'][number],
  cx: number,
  cy: number,
): [number, number][] {
  const polyline =
    segment.kind === 'arc'
      ? sketchArcPolyline(segment)
      : segment.kind === 'ellipse'
        ? sketchEllipsePolyline(segment)
        : [segment.from, segment.to];
  return polyline.map(([x, y]) => [x - cx, y - cy] as [number, number]);
}

/**
 * Returns the display label for draw segment.
 */
function drawSegmentLabel(
  content: THREE.Group,
  segment: ProfilePrimitive['segments'][number],
  normalized: [number, number][],
  viewHalf: number,
): void {
  const mid = normalized[Math.floor(normalized.length / 2)];
  const sprite = labelSprite(
    segmentLabel(segment),
    viewHalf * 0.36,
    viewHalf * 0.11,
  );
  sprite.position.set(mid[0], mid[1] + viewHalf * 0.06, 0);
  content.add(sprite);
}

/**
 * Creates a segment from its endpoint coordinates.
 */
function segmentLabel(segment: ProfilePrimitive['segments'][number]): string {
  if (segment.kind === 'arc') {
    return `${segment.name} r${compactSketchNumber(segment.radius)}`;
  }
  if (segment.kind === 'ellipse') {
    return `${segment.name} ${compactSketchNumber(segment.radiusX * 2)} x ${compactSketchNumber(segment.radiusY * 2)}`;
  }
  return segment.name;
}

/**
 * Handles draw profile bounds in the sketch preview flow.
 */
function drawProfileBounds(
  content: THREE.Group,
  viewHalf: number,
  bounds: ReturnType<typeof sketchBoundsFromPoints>,
  cx: number,
  cy: number,
): void {
  drawBoundsDimensions(
    content,
    viewHalf,
    bounds.minX - cx,
    bounds.maxX - cx,
    bounds.minY - cy,
    bounds.maxY - cy,
    compactSketchNumber(bounds.width),
    compactSketchNumber(bounds.height),
  );
}

/**
 * Builds the profile data required by the current operation.
 */
function profileSegmentColor(primitive: ProfilePrimitive): number {
  const status = primitive.constraintState?.status;
  if (status === 'underconstrained') return CONSTRAINT_UNDER_COLOR;
  if (status === 'no-convergence') return CONSTRAINT_ERROR_COLOR;
  return SKETCH_SHAPE_COLOR;
}

/**
 * Handles draw word in the sketch preview flow.
 */
export function drawWord(
  content: THREE.Group,
  primitive: Extract<IRPrimitive, { kind: 'word' }>,
  viewHalf: number,
): void {
  const width = Math.max(
    primitive.size,
    primitive.text.length * primitive.size * 0.6,
  );
  const hw = width / 2;
  const hh = primitive.size / 2;
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
      SKETCH_DETAIL_COLOR,
    ),
  );
  const text = labelSprite(primitive.text, viewHalf * 0.7, viewHalf * 0.18);
  text.position.set(0, 0, 0);
  content.add(text);
  drawBoundsDimensions(
    content,
    viewHalf,
    -hw,
    hw,
    -hh,
    hh,
    compactSketchNumber(width),
    compactSketchNumber(primitive.size),
  );
}
