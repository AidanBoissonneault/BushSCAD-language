/**
 * @author Aidan Boissonneault
 * @file scene-side-labels.ts
 * @purpose Provides scene side labels behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import {
  createVectorSideLabel,
  type VectorSideLabel,
} from './vector-side-label.js';

/**
 * Named view direction shown around the scene: top, bottom, front, back, right, or left.
 */
export type SceneSideName =
  | 'TOP'
  | 'BOTTOM'
  | 'FRONT'
  | 'BACK'
  | 'RIGHT'
  | 'LEFT';
/**
 * Chooses whether orientation labels sit against the skybox or the model bounds.
 */
export type SceneSideLabelPlacementMode = 'skybox' | 'bounds';

/**
 * Visibility and layout settings for scene orientation labels.
 */
export type SceneSideLabelOptions = {
  visible: boolean;
  placement: SceneSideLabelPlacementMode;
  distance: number;
  opacity: number;
  scale: number;
  color: string;
};

/**
 * Text and viewport position for one orientation label.
 */
export type SceneSideLabelPlacement = {
  label: SceneSideName;
  position: readonly [number, number, number];
};

/**
 * Derives `SkyboxSideLabelTransform` from `SceneSideLabelPlacement & { quaternion: readonly [number,
 * number, number, number]; }` to preserve its type relationship in the scene layer.
 */
export type SkyboxSideLabelTransform = SceneSideLabelPlacement & {
  quaternion: readonly [number, number, number, number];
};

const SIDE_NAMES: readonly SceneSideName[] = [
  'TOP',
  'BOTTOM',
  'FRONT',
  'BACK',
  'RIGHT',
  'LEFT',
];

/**
 * Returns immutable world transforms on an origin-centered skybox.
 * Skybox text must be placed geometry, not camera-facing sprites. Each plane's
 * front normal points inward and its quaternion never depends on the camera or
 * model, so orbiting and moving parts cannot rotate or relocate it.
 */
export function skyboxSideLabelTransforms(
  radius: number,
): SkyboxSideLabelTransform[] {
  const r = Math.max(1, radius);
  return [
    skyboxTransform('TOP', [0, 0, r], [-1, 0, 0], [0, 1, 0], [0, 0, -1]),
    skyboxTransform('BOTTOM', [0, 0, -r], [1, 0, 0], [0, 1, 0], [0, 0, 1]),
    skyboxTransform('FRONT', [0, -r, 0], [-1, 0, 0], [0, 0, 1], [0, 1, 0]),
    skyboxTransform('BACK', [0, r, 0], [1, 0, 0], [0, 0, 1], [0, -1, 0]),
    skyboxTransform('RIGHT', [r, 0, 0], [0, -1, 0], [0, 0, 1], [-1, 0, 0]),
    skyboxTransform('LEFT', [-r, 0, 0], [0, 1, 0], [0, 0, 1], [1, 0, 0]),
  ];
}

/** Positions billboard labels a precise distance outside each model-bound face. */
export function boundsSideLabelPlacements(
  bounds: THREE.Box3,
  distance: number,
): SceneSideLabelPlacement[] {
  if (bounds.isEmpty()) return [];
  const center = bounds.getCenter(new THREE.Vector3());
  const offset = Math.max(0, distance);
  return [
    { label: 'TOP', position: [center.x, center.y, bounds.max.z + offset] },
    { label: 'BOTTOM', position: [center.x, center.y, bounds.min.z - offset] },
    { label: 'FRONT', position: [center.x, bounds.min.y - offset, center.z] },
    { label: 'BACK', position: [center.x, bounds.max.y + offset, center.z] },
    { label: 'RIGHT', position: [bounds.max.x + offset, center.y, center.z] },
    { label: 'LEFT', position: [bounds.min.x - offset, center.y, center.z] },
  ];
}

/**
 * Handles skybox transform in the scene flow.
 */
function skyboxTransform(
  label: SceneSideName,
  position: readonly [number, number, number],
  right: readonly [number, number, number],
  up: readonly [number, number, number],
  inward: readonly [number, number, number],
): SkyboxSideLabelTransform {
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(...right),
    new THREE.Vector3(...up),
    new THREE.Vector3(...inward),
  );
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
  return {
    label,
    position,
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
  };
}

/** Owns fixed skybox planes and the separate model-bounds billboard labels. */
export class SceneSideLabels {
  readonly group = new THREE.Group();
  private readonly skyboxGroup = new THREE.Group();
  private readonly boundsGroup = new THREE.Group();
  private readonly skyboxLabels = new Map<SceneSideName, VectorSideLabel>();
  private readonly boundsLabels = new Map<SceneSideName, VectorSideLabel>();
  private options: SceneSideLabelOptions = {
    visible: false,
    placement: 'skybox',
    distance: 1500,
    opacity: 0.75,
    scale: 1.5,
    color: '#ffb000',
  };

  /**
   * Initializes the `SceneSideLabels` instance and its internal state.
   */
  constructor() {
    this.group.visible = false;
    this.group.add(this.skyboxGroup, this.boundsGroup);
    for (const label of SIDE_NAMES) {
      const skyboxLabel = createVectorSideLabel(label, false);
      const boundsLabel = createVectorSideLabel(label, true);
      this.skyboxLabels.set(label, skyboxLabel);
      this.boundsLabels.set(label, boundsLabel);
      this.skyboxGroup.add(skyboxLabel);
      this.boundsGroup.add(boundsLabel);
    }
  }

  /**
   * Sets options on the owning state.
   */
  setOptions(options: SceneSideLabelOptions): void {
    this.options = {
      ...options,
      distance: Math.max(0, options.distance),
      opacity: THREE.MathUtils.clamp(options.opacity, 0, 1),
      scale: Math.max(0.1, options.scale),
    };
    this.group.visible = options.visible;
    for (const label of this.skyboxLabels.values()) {
      label.material.color.set(options.color);
    }
    for (const label of this.boundsLabels.values()) {
      label.material.color.set(options.color);
    }
  }

  /**
   * Updates while preserving unrelated state.
   */
  update(meshGroup: THREE.Group): void {
    if (this.options.placement === 'skybox') this.updateSkybox();
    else this.updateBounds(meshGroup);
  }

  /**
   * Updates skybox while preserving unrelated state.
   */
  private updateSkybox(): void {
    const radius = Math.max(1, this.options.distance);
    this.group.visible = this.options.visible;
    this.skyboxGroup.visible = true;
    this.boundsGroup.visible = false;
    const width = THREE.MathUtils.clamp(
      radius * 0.3 * this.options.scale,
      100,
      2400,
    );
    for (const transform of skyboxSideLabelTransforms(radius)) {
      const label = this.skyboxLabels.get(transform.label)!;
      label.position.fromArray(transform.position);
      label.quaternion.fromArray(transform.quaternion);
      label.scale.set(width, width, 1);
      label.material.opacity = this.options.opacity;
    }
  }

  /**
   * Updates bounds while preserving unrelated state.
   */
  private updateBounds(meshGroup: THREE.Group): void {
    const bounds = new THREE.Box3().setFromObject(meshGroup);
    const placements = boundsSideLabelPlacements(bounds, this.options.distance);
    this.group.visible = this.options.visible && placements.length > 0;
    this.skyboxGroup.visible = false;
    this.boundsGroup.visible = true;
    if (placements.length === 0) return;
    const size = bounds.getSize(new THREE.Vector3());
    const width = THREE.MathUtils.clamp(
      Math.max(size.x, size.y, size.z) * 0.12,
      10,
      28,
    );
    for (const placement of placements) {
      const label = this.boundsLabels.get(placement.label)!;
      label.position.fromArray(placement.position);
      label.scale.set(width, width, 1);
    }
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    for (const label of this.skyboxLabels.values()) {
      label.geometry.dispose();
      label.material.dispose();
    }
    for (const label of this.boundsLabels.values()) {
      label.geometry.dispose();
      label.material.dispose();
    }
  }
}
