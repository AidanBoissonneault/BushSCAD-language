/**
 * @author Aidan Boissonneault
 * @file sketch-preview-labels.ts
 * @purpose Provides sketch preview labels behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import {
  SKETCH_LABEL_BG,
  SKETCH_LABEL_BORDER,
  SKETCH_LABEL_TEXT,
} from './sketch-preview-theme.js';

/**
 * Creates line geometry from the supplied endpoints.
 */
export function lineSegs(pts: number[], color: number): THREE.LineSegments {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color }));
}

/**
 * Creates a canvas-backed label sprite.
 * Sketch dimensions and profile segment names need screen-readable labels
 * without adding DOM overlays inside the Three-managed canvas.
 */
export function labelSprite(
  text: string,
  scaleW: number,
  scaleH: number,
): THREE.Sprite {
  const cw = 224;
  const ch = 56;
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = SKETCH_LABEL_BG;
  ctx.beginPath();
  ctx.roundRect(2, 2, cw - 4, ch - 4, 6);
  ctx.fill();

  ctx.strokeStyle = SKETCH_LABEL_BORDER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(2, 2, cw - 4, ch - 4, 6);
  ctx.stroke();

  ctx.fillStyle = SKETCH_LABEL_TEXT;
  ctx.font = 'bold 22px system-ui, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cw / 2, ch / 2, cw - 18);

  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(c),
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scaleW, scaleH, 1);
  return sprite;
}
