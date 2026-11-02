/**
 * @author Aidan Boissonneault
 * @file sketch-overlay-presentation.ts
 * @purpose Provides sketch overlay presentation behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { IRPrimitive } from '@bushscad/ir';
import { sketchOverlayGeometry } from './sketch-overlay-geometry.js';

/**
 * Grouped vertex buffers for sketch-preview profiles, construction geometry, and points.
 */
export interface SketchOverlayBuffers {
  profiles: THREE.BufferGeometry | null;
  construction: THREE.BufferGeometry | null;
  points: THREE.BufferGeometry | null;
}

/** Builds the shared Three buffers for one logical sketch definition. */
export function createSketchOverlayBuffers(
  primitive: IRPrimitive,
): SketchOverlayBuffers {
  const geometry = sketchOverlayGeometry(primitive);
  return {
    profiles: bufferGeometry(geometry.profiles),
    construction: bufferGeometry(geometry.construction),
    points: bufferGeometry(geometry.points),
  };
}

/**
 * Adds one instance's visual objects while retaining shared definition buffers.
 * Instance groups need independent materials for selection styling, but
 * their immutable local geometry should not be copied for each placement.
 */
export function populateSketchInstanceGroup(
  group: THREE.Group,
  buffers: SketchOverlayBuffers,
  color: string,
  unsupported: boolean,
): void {
  addLine(group, buffers.profiles, color, 0.96);
  addLine(group, buffers.construction, color, 0.46, true);
  addPoints(group, buffers.points, color);
  if (unsupported) addUnsupportedCue(group);
}

/** Releases geometry shared by all rendered instances of one definition. */
export function disposeSketchOverlayBuffers(
  buffers: SketchOverlayBuffers,
): void {
  Object.values(buffers).forEach((geometry) => geometry?.dispose());
}

/**
 * Handles buffer geometry in the sketch preview flow.
 */
function bufferGeometry(
  values: readonly number[],
): THREE.BufferGeometry | null {
  if (values.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(values, 3),
  );
  return geometry;
}

/**
 * Adds line to its owning collection.
 */
function addLine(
  group: THREE.Group,
  geometry: THREE.BufferGeometry | null,
  color: string,
  opacity: number,
  dashed = false,
): void {
  if (!geometry) return;
  const material = dashed
    ? new THREE.LineDashedMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: true,
        dashSize: 2,
        gapSize: 1,
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: true,
      });
  const lines = new THREE.LineSegments(geometry, material);
  if (dashed) lines.computeLineDistances();
  lines.renderOrder = 5;
  group.add(lines);
}

/**
 * Adds points to its owning collection.
 */
function addPoints(
  group: THREE.Group,
  geometry: THREE.BufferGeometry | null,
  color: string,
): void {
  if (!geometry) return;
  group.add(
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color,
        size: 5,
        sizeAttenuation: false,
        depthTest: true,
      }),
    ),
  );
}

/**
 * Adds unsupported cue to its owning collection.
 */
function addUnsupportedCue(group: THREE.Group): void {
  const geometry = bufferGeometry([
    -2, -2, 0.1, 2, 2, 0.1, -2, 2, 0.1, 2, -2, 0.1,
  ]);
  if (!geometry) return;
  const material = new THREE.LineBasicMaterial({
    color: '#ef4444',
    depthTest: false,
  });
  const cue = new THREE.LineSegments(geometry, material);
  cue.userData.ownedSketchCueGeometry = true;
  group.add(cue);
}
