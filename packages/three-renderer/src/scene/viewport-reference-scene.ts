/**
 * @author Aidan Boissonneault
 * @file viewport-reference-scene.ts
 * @purpose Provides viewport reference scene behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import {
  applyCenterPlaneGimbalOptions,
  createCenterPlaneGimbal,
  type CenterPlaneGimbalOptions,
} from './center-plane-gimbal.js';
import {
  applyGroundGridOptions,
  createGroundGrid,
  disposeGroundGrid,
  updateGroundGridForView,
  type GroundGridOptions,
} from './ground-grid.js';
import {
  SceneSideLabels,
  type SceneSideLabelOptions,
} from './scene-side-labels.js';

export type {
  CenterPlaneGimbalOptions,
  GroundGridOptions,
  SceneSideLabelOptions,
};

/** Owns the axis, ground, and semantic side references around model geometry. */
export class ViewportReferenceScene {
  private readonly centerPlaneGimbal = createCenterPlaneGimbal();
  private readonly groundGrid = createGroundGrid();
  private readonly sceneSideLabels = new SceneSideLabels();

  /**
   * Initializes the `ViewportReferenceScene` instance with the values supplied by its caller.
   */
  constructor(scene: THREE.Scene) {
    scene.add(
      this.groundGrid,
      this.centerPlaneGimbal,
      this.sceneSideLabels.group,
    );
  }

  /**
   * Sets axis visible on the owning state.
   */
  setAxisVisible(visible: boolean): void {
    this.centerPlaneGimbal.visible = visible;
  }

  /**
   * Sets axis options on the owning state.
   */
  setAxisOptions(options: CenterPlaneGimbalOptions): void {
    applyCenterPlaneGimbalOptions(this.centerPlaneGimbal, options);
  }

  /**
   * Sets ground options on the owning state.
   */
  setGroundOptions(options: GroundGridOptions): void {
    applyGroundGridOptions(this.groundGrid, options);
  }

  /** Keeps the visible world grid and its measurements aligned with the camera. */
  updateGroundGridForView(
    camera: THREE.PerspectiveCamera,
    target: THREE.Vector3,
    viewportHeight: number,
  ): void {
    updateGroundGridForView(this.groundGrid, camera, target, viewportHeight);
  }

  /**
   * Sets side label options on the owning state.
   */
  setSideLabelOptions(options: SceneSideLabelOptions): void {
    this.sceneSideLabels.setOptions(options);
  }

  /**
   * Updates while preserving unrelated state.
   */
  update(modelGroup: THREE.Group): void {
    this.sceneSideLabels.update(modelGroup);
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    disposeGroundGrid(this.groundGrid);
    this.sceneSideLabels.dispose();
  }
}
