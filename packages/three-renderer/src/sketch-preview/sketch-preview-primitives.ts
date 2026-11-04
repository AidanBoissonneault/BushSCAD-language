/**
 * @author Aidan Boissonneault
 * @file sketch-preview-primitives.ts
 * @purpose Dispatches IR sketch primitives to their feature renderers.
 * @last-edited November 4, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive } from '@bushscad/ir';
import { drawCircle } from './primitives/circle/draw.js';
import { drawEllipse } from './primitives/ellipse/draw.js';
import { drawPolygon } from './primitives/polygon/draw.js';
import { drawRect } from './primitives/rect/draw.js';
import { drawRoundRect } from './primitives/roundrect/draw.js';
import { drawTriangle } from './primitives/triangle/draw.js';

/**
 * Draws a primitive outline and its dimensions in the sketch preview.
 *
 * Why:
 * A single exhaustive dispatch keeps primitive selection in one place while
 * each shape's geometry stays in its own feature module.
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
