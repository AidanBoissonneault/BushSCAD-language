import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  alignPlaneToNormal,
  snapPreset,
} from '../../src/scene/gizmo-orientation.js';

describe('gizmo orientation', () => {
  it('aligns a plane with each signed axis normal', () => {
    const cases = [
      { normal: new THREE.Vector3(1, 0, 0), axis: 'y', rotation: Math.PI / 2 },
      {
        normal: new THREE.Vector3(-1, 0, 0),
        axis: 'y',
        rotation: -Math.PI / 2,
      },
      { normal: new THREE.Vector3(0, 1, 0), axis: 'x', rotation: -Math.PI / 2 },
      { normal: new THREE.Vector3(0, -1, 0), axis: 'x', rotation: Math.PI / 2 },
      { normal: new THREE.Vector3(0, 0, -1), axis: 'x', rotation: Math.PI },
    ] as const;

    for (const { normal, axis, rotation } of cases) {
      const plane = new THREE.Object3D();

      alignPlaneToNormal(plane, normal);

      expect(plane.rotation[axis]).toBe(rotation);
    }
  });

  it('leaves a positive z-facing plane at its default orientation', () => {
    const plane = new THREE.Object3D();
    plane.rotation.set(0, 0, 0);

    alignPlaneToNormal(plane, new THREE.Vector3(0, 0, 1));

    expect(plane.rotation.toArray()).toEqual([0, 0, 0, 'XYZ']);
  });

  it('snaps a dominant axis to a signed unit axis', () => {
    expect(snapPreset(new THREE.Vector3(-5, 1, 0))).toEqual(
      new THREE.Vector3(-1, 0, 0),
    );
  });

  it('keeps two or three significant components when directions are diagonal', () => {
    expect(snapPreset(new THREE.Vector3(1, 1, 0))).toEqual(
      new THREE.Vector3(1, 1, 0).normalize(),
    );
    expect(snapPreset(new THREE.Vector3(1, 1, 1))).toEqual(
      new THREE.Vector3(1, 1, 1).normalize(),
    );
  });
});
