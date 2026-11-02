/**
 * @author Aidan Boissonneault
 * @file camera-navigation.ts
 * @purpose Provides camera navigation behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CameraFocus, type CameraFocusOptions } from './camera-focus.js';

const HOME_DIRECTION = new THREE.Vector3(1, -1, 0.75).normalize();

/** Owns CAD camera framing and direction changes around OrbitControls. */
export class CameraNavigation {
  private readonly focus: CameraFocus;

  /**
   * Initializes the `CameraNavigation` instance with the values supplied by its caller.
   */
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
    private readonly modelGroup: THREE.Group,
    private readonly changed: () => void,
  ) {
    this.focus = new CameraFocus(camera, controls, changed);
  }

  /** Centers world-space entity bounds without changing the viewing direction. */
  focusEntity(bounds: THREE.Box3, options?: CameraFocusOptions): boolean {
    return this.focus.focusEntity(bounds, options);
  }

  /**
   * Cancels focus and restores the prior state.
   */
  cancelFocus(): void {
    this.focus.cancel();
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.focus.dispose();
  }

  /**
   * Handles snap to direction in the scene flow.
   */
  snapToDirection(direction: THREE.Vector3): void {
    const target = this.controls.target.clone();
    const distance = Math.max(this.camera.position.distanceTo(target), 200);
    this.setViewDirection(direction, distance, target);
  }

  /**
   * Handles orbit to direction in the scene flow.
   */
  orbitToDirection(direction: THREE.Vector3): void {
    const target = this.controls.target.clone();
    const distance = Math.max(this.camera.position.distanceTo(target), 1);
    this.setViewDirection(direction, distance, target);
  }

  /**
   * Handles home view in the scene flow.
   */
  homeView(): void {
    const box = new THREE.Box3().setFromObject(this.modelGroup);
    const target = new THREE.Vector3();
    let radius = 120;
    if (!box.isEmpty()) {
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      target.copy(sphere.center);
      radius = Math.max(sphere.radius, 1);
    }
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const distance = Math.max((radius / Math.sin(fov / 2)) * 1.18, 200);
    this.setViewDirection(HOME_DIRECTION, distance, target);
  }

  /**
   * Handles snap to in the scene flow.
   */
  snapTo(
    direction: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right',
  ): void {
    const directions: Record<string, THREE.Vector3> = {
      top: new THREE.Vector3(0, 0, 1),
      bottom: new THREE.Vector3(0, 0, -1),
      front: new THREE.Vector3(0, -1, 0),
      back: new THREE.Vector3(0, 1, 0),
      right: new THREE.Vector3(1, 0, 0),
      left: new THREE.Vector3(-1, 0, 0),
    };
    this.snapToDirection(directions[direction]);
  }

  /**
   * Returns state from the supplied input.
   */
  getState(): { position: THREE.Vector3; target: THREE.Vector3 } {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
    };
  }

  /**
   * Sets state on the owning state.
   */
  setState(position: THREE.Vector3Like, target: THREE.Vector3Like): void {
    this.focus.cancel();
    this.camera.position.set(position.x, position.y, position.z);
    this.controls.target.set(target.x, target.y, target.z);
    this.camera.up.copy(
      viewUpForDirection(
        this.camera.position.clone().sub(this.controls.target),
      ),
    );
    this.controls.update();
  }

  /**
   * Sets view direction on the owning state.
   */
  private setViewDirection(
    direction: THREE.Vector3,
    distance: number,
    target: THREE.Vector3,
  ): void {
    this.focus.cancel();
    const viewDirection = direction.clone().normalize();
    this.camera.up.copy(viewUpForDirection(viewDirection));
    this.controls.target.copy(target);
    this.camera.position.copy(target).addScaledVector(viewDirection, distance);
    this.camera.lookAt(target);
    this.controls.update();
    this.changed();
  }
}

/**
 * Handles view up for direction in the scene flow.
 */
function viewUpForDirection(direction: THREE.Vector3): THREE.Vector3 {
  const viewDirection = direction.clone().normalize();
  const z = new THREE.Vector3(0, 0, 1);
  return Math.abs(viewDirection.dot(z)) > 0.96
    ? new THREE.Vector3(0, viewDirection.z > 0 ? 1 : -1, 0)
    : z;
}
