/**
 * @author Aidan Boissonneault
 * @file camera-focus.test.ts
 * @purpose Tests camera focus behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CameraFocus,
  type CameraFocusScheduler,
} from '../../src/scene/camera-focus.js';

describe('camera focus', () => {
  it('centers immediately for reduced motion while preserving view direction', () => {
    const camera = cameraAt(10, -10, 10);
    const controls = new FakeControls();
    const completed = vi.fn();
    const focus = new CameraFocus(
      camera,
      controls as unknown as OrbitControls,
      completed,
      new FakeScheduler(),
    );
    const beforeDirection = camera.position
      .clone()
      .sub(controls.target)
      .normalize();

    expect(
      focus.focusEntity(
        new THREE.Box3(new THREE.Vector3(4, 5, 6), new THREE.Vector3(6, 7, 8)),
        {
          reducedMotion: true,
        },
      ),
    ).toBe(true);

    expect(controls.target.toArray()).toEqual([5, 6, 7]);
    expect(
      camera.position.clone().sub(controls.target).normalize().toArray(),
    ).toEqual(beforeDirection.toArray());
    expect(completed).toHaveBeenCalledTimes(1);
    focus.dispose();
  });

  it('emits once after animation and cancels on manual control input', () => {
    const camera = cameraAt(10, 0, 0);
    const controls = new FakeControls();
    const scheduler = new FakeScheduler();
    const completed = vi.fn();
    const focus = new CameraFocus(
      camera,
      controls as unknown as OrbitControls,
      completed,
      scheduler,
    );
    const bounds = new THREE.Box3(
      new THREE.Vector3(4, -1, -1),
      new THREE.Vector3(6, 1, 1),
    );

    focus.focusEntity(bounds, { durationMs: 100 });
    scheduler.run(50);
    expect(completed).not.toHaveBeenCalled();
    scheduler.run(100);
    expect(completed).toHaveBeenCalledTimes(1);
    expect(controls.target.x).toBe(5);

    focus.focusEntity(bounds, { durationMs: 100 });
    controls.emit('start');
    scheduler.run(200);
    expect(completed).toHaveBeenCalledTimes(1);
    focus.dispose();
  });
});

/**
 * Handles camera at in the scene flow.
 */
function cameraAt(x: number, y: number, z: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10_000);
  camera.position.set(x, y, z);
  return camera;
}

/**
 * Owns `FakeScheduler` state and behavior for the scene layer.
 */
class FakeScheduler implements CameraFocusScheduler {
  private callback: FrameRequestCallback | null = null;
  /**
   * Handles now in the scene flow.
   */
  now(): number {
    return 0;
  }
  /**
   * Handles request in the scene flow.
   */
  request(callback: FrameRequestCallback): number {
    this.callback = callback;
    return 1;
  }
  /**
   * Cancels and restores the prior state.
   */
  cancel(): void {
    this.callback = null;
  }
  /**
   * Runs and returns its result.
   */
  run(time: number): void {
    const callback = this.callback;
    this.callback = null;
    callback?.(time);
  }
}

/**
 * Owns `FakeControls` state and behavior for the scene layer.
 */
class FakeControls {
  readonly target = new THREE.Vector3();
  private readonly listeners = new Map<string, Set<() => void>>();
  /**
   * Updates while preserving unrelated state.
   */
  update(): void {}
  /**
   * Adds event listener to its owning collection.
   */
  addEventListener(type: string, callback: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(callback);
    this.listeners.set(type, listeners);
  }
  /**
   * Removes event listener from its owning collection.
   */
  removeEventListener(type: string, callback: () => void): void {
    this.listeners.get(type)?.delete(callback);
  }
  /**
   * Emits the result into the current output.
   */
  emit(type: string): void {
    this.listeners.get(type)?.forEach((callback) => callback());
  }
}
