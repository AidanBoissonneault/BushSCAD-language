/**
 * @author Aidan Boissonneault
 * @file sketch-preview-primitive-dispatch.ts
 * @purpose Routes preview primitives to their corresponding sketch renderers.
 * @last-edited November 3, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive, SketchPreviewModel } from '@bushscad/ir';
import { drawPrimitive } from './sketch-preview-primitives.js';
import { drawProfile, drawWord } from './sketch-preview-profiles.js';

/** Draws nested, boolean, profile, text, and primitive sketch preview nodes. */
export function drawSketchPrimitive(
  target: THREE.Group,
  primitive: IRPrimitive,
  preview: SketchPreviewModel,
  viewHalf: number,
): void {
  if (primitive.kind === 'sketchAt') {
    const group = new THREE.Group();
    group.position.set(primitive.x, primitive.y, 0);
    target.add(group);
    drawSketchPrimitive(group, primitive.primitive, preview, viewHalf);
    return;
  }
  if (primitive.kind === 'sketchBoolean') {
    drawSketchPrimitive(target, primitive.left, preview, viewHalf);
    drawSketchPrimitive(target, primitive.right, preview, viewHalf);
    return;
  }
  if (primitive.kind === 'sketchRef') return;
  if (primitive.kind === 'profile') {
    drawProfile(target, primitive, preview, viewHalf);
  } else if (primitive.kind === 'word') {
    drawWord(target, primitive, viewHalf);
  } else {
    drawPrimitive(target, primitive, viewHalf);
  }
}
