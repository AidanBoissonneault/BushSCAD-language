/**
 * @author Aidan Boissonneault
 * @file gizmo-rendering.test.ts
 * @purpose Tests orientation gizmo canvas sizing and hover indicators.
 * @last-edited November 3, 2026
 */

import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resizeGizmoRenderer,
  setGizmoHover,
} from '../../src/scene/gizmo.js';

afterEach(() => vi.unstubAllGlobals());

describe('gizmo rendering helpers', () => {
  it('resizes its drawing buffer only when the device pixel dimensions differ', () => {
    vi.stubGlobal('window', { devicePixelRatio: 2 });
    const canvas = {
      clientWidth: 80,
      clientHeight: 50,
      width: 1,
      height: 1,
    } as HTMLCanvasElement;
    const renderer = {
      domElement: canvas,
      setPixelRatio: vi.fn(),
      setSize: vi.fn(),
    };

    resizeGizmoRenderer(renderer);
    expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
    expect(renderer.setSize).toHaveBeenCalledWith(80, 50, false);

    canvas.width = 160;
    canvas.height = 100;
    renderer.setSize.mockClear();
    resizeGizmoRenderer(renderer);
    expect(renderer.setSize).not.toHaveBeenCalled();
  });

  it('updates, retains, and disposes face, edge, and cleared hover markers', () => {
    const group = new THREE.Group();
    const faceDirection = new THREE.Vector3(0, 0, 1);
    const faceKey = setGizmoHover(group, faceDirection, '');
    const faceMarker = group.children[0] as THREE.Mesh;
    expect(faceMarker.geometry).toBeInstanceOf(THREE.PlaneGeometry);

    expect(setGizmoHover(group, faceDirection, faceKey)).toBe(faceKey);
    expect(group.children[0]).toBe(faceMarker);

    const dispose = vi.spyOn(faceMarker.geometry, 'dispose');
    const edgeKey = setGizmoHover(
      group,
      new THREE.Vector3(1, 1, 0),
      faceKey,
    );
    expect(dispose).toHaveBeenCalledOnce();
    expect(group.children[0]).not.toBe(faceMarker);
    expect((group.children[0] as THREE.Mesh).geometry).toBeInstanceOf(
      THREE.SphereGeometry,
    );

    setGizmoHover(group, null, edgeKey);
    expect(group.children).toHaveLength(0);
  });
});
