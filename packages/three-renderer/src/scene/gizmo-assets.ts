/**
 * @author Aidan Boissonneault
 * @file gizmo-assets.ts
 * @purpose Provides gizmo assets behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';

export const FACE_LABELS = [
  { label: 'TOP', n: new THREE.Vector3(0, 0, 1), textRotation: 0 },
  { label: 'BOTTOM', n: new THREE.Vector3(0, 0, -1), textRotation: 0 },
  { label: 'FRONT', n: new THREE.Vector3(0, -1, 0), textRotation: 0 },
  { label: 'BACK', n: new THREE.Vector3(0, 1, 0), textRotation: Math.PI },
  { label: 'RIGHT', n: new THREE.Vector3(1, 0, 0), textRotation: -Math.PI / 2 },
  { label: 'LEFT', n: new THREE.Vector3(-1, 0, 0), textRotation: Math.PI / 2 },
];

export const CORNERS: THREE.Vector3[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [1, -1, 1],
  [-1, -1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [1, -1, -1],
  [-1, -1, -1],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

export const EDGES: THREE.Vector3[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 0, -1],
  [-1, 0, -1],
  [0, 1, -1],
  [0, -1, -1],
  [1, 1, 0],
  [-1, 1, 0],
  [1, -1, 0],
  [-1, -1, 0],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

export const AXES = [
  { label: 'X', color: '#d63b2f', dir: new THREE.Vector3(1, 0, 0) },
  { label: 'Y', color: '#269b54', dir: new THREE.Vector3(0, -1, 0) },
  { label: 'Z', color: '#2f76c8', dir: new THREE.Vector3(0, 0, 1) },
];

/**
 * Constructs face texture from the supplied values.
 */
export function makeFaceTexture(
  label: string,
  textRotation = 0,
): THREE.CanvasTexture {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;

  const bg = ctx.createLinearGradient(0, 0, 0, s);
  bg.addColorStop(0, '#f8f9fb');
  bg.addColorStop(1, '#d6dce3');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(13, 13, s - 26, s - 26, 14);
  ctx.fill();

  ctx.strokeStyle = '#9fa8b4';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(13, 13, s - 26, s - 26, 14);
  ctx.stroke();

  ctx.font = '700 48px Segoe UI, system-ui, sans-serif';
  while (ctx.measureText(label).width > s * 0.72) {
    const size = Number(ctx.font.match(/\d+/)?.[0] ?? 48) - 3;
    ctx.font = `700 ${size}px Segoe UI, system-ui, sans-serif`;
  }
  ctx.fillStyle = '#343a40';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(textRotation);
  ctx.fillText(label, 0, 2);
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Constructs axis texture from the supplied values.
 */
export function makeAxisTexture(
  label: string,
  color: string,
): THREE.CanvasTexture {
  const s = 96;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.beginPath();
  ctx.arc(s / 2, s / 2, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.font = '700 42px Segoe UI, system-ui, sans-serif';
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, s / 2, s / 2 + 1);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Handles invis mat in the scene flow.
 */
export function invisMat(): THREE.Material {
  return new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
}
