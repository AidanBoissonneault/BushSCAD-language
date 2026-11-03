/**
 * @author Aidan Boissonneault
 * @file viewport-guides.test.ts
 * @purpose Tests viewport guides behavior in the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  boundsSideLabelPlacements,
  SceneSideLabels,
  skyboxSideLabelTransforms,
} from '../../src/scene/scene-side-labels.js';
import {
  applyGroundGridOptions,
  createGroundGrid,
  disposeGroundGrid,
  updateGroundGridForView,
} from '../../src/scene/ground-grid.js';
import {
  buildVolumeOutlineGeometry,
  heightGuideGeometry,
} from '../../src/scene/build-volume-guide.js';
import {
  infiniteWorldGridGeometry,
  worldGridIntervalForView,
} from '../../src/scene/infinite-world-grid.js';

describe('viewport guides', () => {
  const bounds = new THREE.Box3(
    new THREE.Vector3(-10, -20, -5),
    new THREE.Vector3(30, 40, 15),
  );

  it('places skybox text at fixed world positions with inward fixed rotations', () => {
    const placements = skyboxSideLabelTransforms(1500);
    const byName = new Map(
      placements.map((placement) => [placement.label, placement.position]),
    );

    expect(byName.get('FRONT')).toEqual([0, -1500, 0]);
    expect(byName.get('BACK')).toEqual([0, 1500, 0]);
    expect(byName.get('RIGHT')).toEqual([1500, 0, 0]);
    expect(byName.get('TOP')).toEqual([0, 0, 1500]);

    for (const transform of placements) {
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(
        new THREE.Quaternion().fromArray(transform.quaternion),
      );
      const inward = new THREE.Vector3(...transform.position)
        .negate()
        .normalize();
      expect(normal.dot(inward)).toBeCloseTo(1);
    }
  });

  it('can place labels a precise distance from each model-bound face', () => {
    const placements = boundsSideLabelPlacements(bounds, 7);
    const byName = new Map(
      placements.map((placement) => [placement.label, placement.position]),
    );

    expect(byName.get('FRONT')?.[1]).toBe(-27);
    expect(byName.get('BACK')?.[1]).toBe(47);
    expect(byName.get('RIGHT')?.[0]).toBe(37);
    expect(byName.get('TOP')?.[2]).toBe(22);
  });

  it('keeps colored skybox labels visible above scene geometry', () => {
    const labels = new SceneSideLabels();
    labels.setOptions({
      visible: true,
      placement: 'skybox',
      distance: 1500,
      opacity: 0.8,
      scale: 4,
      color: '#12abef',
    });
    labels.update(new THREE.Group());

    const skybox = labels.group.children[0] as THREE.Group;
    const label = skybox.children[0] as THREE.Mesh<
      THREE.ShapeGeometry,
      THREE.MeshBasicMaterial
    >;
    expect(labels.group.visible).toBe(true);
    expect(label.renderOrder).toBe(1000);
    expect(label.material.depthTest).toBe(false);
    expect(label.material.toneMapped).toBe(false);
    expect(label.material.color.getHexString()).toBe('12abef');
    expect(label.geometry.type).toBe('ShapeGeometry');
    expect(label.material.map).toBeNull();
    labels.dispose();
  });

  it('draws a separate exact printer-bed outline', () => {
    const geometry = buildVolumeOutlineGeometry(220, 180);
    const positions = geometry.getAttribute('position');
    const xs = Array.from({ length: positions.count }, (_, index) =>
      positions.getX(index),
    );
    const ys = Array.from({ length: positions.count }, (_, index) =>
      positions.getY(index),
    );

    expect(Math.min(...xs)).toBe(-110);
    expect(Math.max(...xs)).toBe(110);
    expect(Math.min(...ys)).toBe(-90);
    expect(Math.max(...ys)).toBe(90);
  });

  it('draws origin-aligned world lines without a finite rectangular frame', () => {
    const geometry = infiniteWorldGridGeometry(
      { minX: -100, maxX: 100, minY: -50, maxY: 50 },
      10,
    );
    const positions = geometry.getAttribute('position');
    const segments = Array.from(
      { length: positions.count / 2 },
      (_, index) => [
        [positions.getX(index * 2), positions.getY(index * 2)],
        [positions.getX(index * 2 + 1), positions.getY(index * 2 + 1)],
      ],
    );

    expect(segments).toContainEqual([
      [0, -50],
      [0, 50],
    ]);
    expect(segments).toContainEqual([
      [-100, 0],
      [100, 0],
    ]);
    expect(segments).toHaveLength(32);
  });

  it('increases grid intervals with camera distance to retain readable spacing', () => {
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    const target = new THREE.Vector3(0, 0, 0);
    camera.position.set(0, -300, 200);
    const near = worldGridIntervalForView(camera, target, 800, 10);
    camera.position.set(0, -8000, 5000);
    const far = worldGridIntervalForView(camera, target, 800, 10);

    expect(near.interval).toBeGreaterThanOrEqual(10);
    expect(far.interval).toBeGreaterThan(near.interval);
    expect(far.interval % 10).toBe(0);
  });

  it('applies grid dimensions, visibility, and optional height ruler live', () => {
    const grid = createGroundGrid();

    applyGroundGridOptions(grid, {
      visible: false,
      opacity: 0.34,
      width: 200,
      depth: 180,
      height: 240,
      interval: 10,
      unit: 'mm',
      heightGuideVisible: true,
      centerX: 35,
      centerY: -20,
    });

    expect(grid.visible).toBe(false);
    expect(grid.position.toArray()).toEqual([0, 0, 0]);
    expect(
      grid.getObjectByName('printer-bed-references')?.position.toArray(),
    ).toEqual([35, -20, 0]);
    expect(grid.getObjectByName('build-height-guide')).toBeDefined();
    const lines = grid.getObjectByName(
      'infinite-world-grid-lines',
    ) as THREE.LineSegments;
    const outline = grid.getObjectByName(
      'printer-bed-outline',
    ) as THREE.LineSegments;
    for (const material of [lines.material, outline.material]) {
      for (const item of Array.isArray(material) ? material : [material]) {
        expect(item.opacity).toBe(0.34);
        expect(item.depthWrite).toBe(false);
      }
    }
  });

  it('expands the world grid without displaying numeric coordinate labels', () => {
    const grid = createGroundGrid();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    const target = new THREE.Vector3(8000, -6000, 0);
    camera.up.set(0, 0, 1);
    camera.position.set(8200, -6200, 150);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);

    updateGroundGridForView(grid, camera, target, 800);

    const lines = grid.getObjectByName(
      'infinite-world-grid-lines',
    ) as THREE.LineSegments;
    const positions = lines.geometry.getAttribute('position');
    const xs = Array.from({ length: positions.count }, (_, index) =>
      positions.getX(index),
    );
    const ys = Array.from({ length: positions.count }, (_, index) =>
      positions.getY(index),
    );
    expect(Math.min(...xs)).toBeLessThan(target.x);
    expect(Math.max(...xs)).toBeGreaterThan(target.x);
    expect(Math.min(...ys)).toBeLessThan(target.y);
    expect(Math.max(...ys)).toBeGreaterThan(target.y);
    expect(grid.getObjectByName('world-grid-measurements')).toBeUndefined();
    const sprites: THREE.Sprite[] = [];
    grid.traverse((object) => {
      if (object instanceof THREE.Sprite) sprites.push(object);
    });
    expect(sprites).toHaveLength(0);
    disposeGroundGrid(grid);
  });

  it('caps the ruler at the configured maximum height', () => {
    const geometry = heightGuideGeometry(220, 220, 250, 10);
    const positions = geometry.getAttribute('position');
    const zs = Array.from({ length: positions.count }, (_, index) =>
      positions.getZ(index),
    );

    expect(Math.min(...zs)).toBe(0);
    expect(Math.max(...zs)).toBe(250);
  });
});
