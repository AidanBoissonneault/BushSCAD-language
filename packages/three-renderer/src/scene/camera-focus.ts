/**
 * @author Aidan Boissonneault
 * @file camera-focus.ts
 * @purpose Provides camera focus behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Options for camera focus, including reduced motion and duration milliseconds.
 */
export type CameraFocusOptions = {
  readonly reducedMotion?: boolean;
  readonly durationMs?: number;
};

/**
 * Camera focus scheduler, including now, request callback, and cancellation callback.
 */
export type CameraFocusScheduler = {
  now(): number;
  request(callback: FrameRequestCallback): number;
  cancel(handle: number): void;
};

const DEFAULT_DURATION_MS = 220;

/** Animates OrbitControls focus while preserving the current viewing direction. */
export class CameraFocus {
  private frame: number | null = null;
  private readonly onControlsStart = (): void => this.cancel();

  /**
   * Initializes the `CameraFocus` instance with the values supplied by its caller.
   */
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly completed: () => void,
    private readonly scheduler: CameraFocusScheduler = browserScheduler(),
  ) {
    this.controls.addEventListener('start', this.onControlsStart);
  }

  /** Centers aggregate bounds and emits exactly one completion callback. */
  focusEntity(bounds: THREE.Box3, options: CameraFocusOptions = {}): boolean {
    if (bounds.isEmpty()) return false;
    this.cancel();
    const startPosition = this.camera.position.clone();
    const startTarget = this.controls.target.clone();
    const endTarget = bounds.getCenter(new THREE.Vector3());
    const direction = startPosition.clone().sub(startTarget);
    if (direction.lengthSq() < Number.EPSILON) direction.set(1, -1, 0.75);
    const currentDistance = Math.max(direction.length(), 1);
    direction.normalize();
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const distance = Math.max(
      currentDistance,
      fitDistance(this.camera, sphere.radius),
    );
    const endPosition = endTarget.clone().addScaledVector(direction, distance);
    const duration = options.reducedMotion
      ? 0
      : (options.durationMs ?? DEFAULT_DURATION_MS);
    if (duration <= 0) {
      this.apply(endPosition, endTarget, sphere.radius);
      this.completed();
      return true;
    }
    const startedAt = this.scheduler.now();
    /**
     * Handles animate in the scene flow.
     */
    const animate = (timestamp: number): void => {
      const progress = THREE.MathUtils.clamp(
        (timestamp - startedAt) / duration,
        0,
        1,
      );
      const eased = 1 - Math.pow(1 - progress, 3);
      const position = startPosition.clone().lerp(endPosition, eased);
      const target = startTarget.clone().lerp(endTarget, eased);
      this.apply(position, target, sphere.radius);
      if (progress < 1) {
        this.frame = this.scheduler.request(animate);
        return;
      }
      this.frame = null;
      this.completed();
    };
    this.frame = this.scheduler.request(animate);
    return true;
  }

  /**
   * Cancels and restores the prior state.
   */
  cancel(): void {
    if (this.frame === null) return;
    this.scheduler.cancel(this.frame);
    this.frame = null;
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.cancel();
    this.controls.removeEventListener('start', this.onControlsStart);
  }

  /**
   * Applies to the supplied state or geometry.
   */
  private apply(
    position: THREE.Vector3,
    target: THREE.Vector3,
    radius: number,
  ): void {
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    const distance = Math.max(position.distanceTo(target), 1);
    this.camera.near = Math.max(0.01, Math.min(0.1, distance / 1000));
    this.camera.far = Math.max(10_000, distance + Math.max(radius, 1) * 4);
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(target);
    this.controls.update();
  }
}

/**
 * Handles fit distance in the scene flow.
 */
function fitDistance(camera: THREE.PerspectiveCamera, radius: number): number {
  if (radius <= 0) return 1;
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov =
    2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
  const limitingFov = Math.max(0.01, Math.min(verticalFov, horizontalFov));
  return (radius / Math.sin(limitingFov / 2)) * 1.08;
}

/**
 * Handles browser scheduler in the scene flow.
 */
function browserScheduler(): CameraFocusScheduler {
  return {
    now: () => performance.now(),
    request: (callback) => requestAnimationFrame(callback),
    cancel: (handle) => cancelAnimationFrame(handle),
  };
}
