/**
 * @author Aidan Boissonneault
 * @file ground-grid.ts
 * @purpose Coordinates the infinite world grid and printer-bed references.
 * @last-edited November 2, 2026
 */

import * as THREE from 'three';
import { buildVolumeOutlineGeometry, heightGuideGeometry } from './build-volume-guide.js';
import {
  createInfiniteWorldGrid,
  infiniteWorldGridGeometry,
  paddedWorldGridBounds,
  updateInfiniteWorldGrid,
  worldGridIntervalForView,
  worldGridViewBounds,
  type WorldGridBounds,
} from './infinite-world-grid.js';
/** Options for an infinite ground grid and its separate printer-bed reference. */
export type GroundGridOptions = {
  visible: boolean;
  opacity: number;
  width: number;
  depth: number;
  height: number;
  interval: number;
  /** Kept for API compatibility; the 3D viewer does not render grid coordinates. */
  unit?: 'mm' | 'in';
  heightGuideVisible: boolean;
  centerX: number;
  centerY: number;
  minorColor?: string;
  axisColor?: string;
  heightColor?: string;
};

type GroundGridState = {
  lines: THREE.LineSegments;
  bedReferences: THREE.Group;
  bedOutline: THREE.LineSegments;
  heightGuide: THREE.LineSegments;
  options: GroundGridOptions;
  bounds: WorldGridBounds;
  interval: number;
  bedSignature: string;
};

const GRID_MINOR_COLOR = new THREE.Color('#d4cfc8');
const GRID_MAJOR_COLOR = new THREE.Color('#b8b0a0');
const GRID_AXIS_COLOR = new THREE.Color('#8b8171');
const HEIGHT_GUIDE_COLOR = new THREE.Color('#e2a53a');
const HEIGHT_GUIDE_NAME = 'build-height-guide';
const BED_OUTLINE_NAME = 'printer-bed-outline';
const groundGridStates = new WeakMap<THREE.Group, GroundGridState>();

/** Creates the infinite ground reference and its independent printer-bed outline. */
export function createGroundGrid(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'ground-grid';

  const lines = createInfiniteWorldGrid();
  lines.position.z = -0.04;
  const bedReferences = new THREE.Group();
  bedReferences.name = 'printer-bed-references';
  const bedOutline = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      color: GRID_MAJOR_COLOR,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  bedOutline.name = BED_OUTLINE_NAME;
  bedOutline.position.z = 0.04;
  const heightGuide = new THREE.LineSegments(
    new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  heightGuide.name = HEIGHT_GUIDE_NAME;
  bedReferences.add(bedOutline, heightGuide);
  group.add(lines, bedReferences);

  const options: GroundGridOptions = {
    visible: true,
    opacity: 0.22,
    width: 220,
    depth: 220,
    height: 250,
    interval: 10,
    unit: 'mm',
    heightGuideVisible: false,
    centerX: 0,
    centerY: 0,
  };
  const extent = Math.max(options.width, options.depth, 1000) * 2;
  const bounds = {
    minX: -extent,
    maxX: extent,
    minY: -extent,
    maxY: extent,
  };
  groundGridStates.set(group, {
    lines,
    bedReferences,
    bedOutline,
    heightGuide,
    options,
    bounds,
    interval: 0,
    bedSignature: '',
  });
  applyGroundGridOptions(group, options);
  return group;
}

/** Applies durable grid preferences without moving the origin-aligned world grid. */
export function applyGroundGridOptions(
  grid: THREE.Group,
  options: GroundGridOptions,
): void {
  const state = groundGridStates.get(grid);
  if (!state) return;

  grid.visible = options.visible;
  const resolvedOptions = {
    ...options,
    unit: options.unit ?? state.options.unit ?? 'mm',
  };
  state.options = resolvedOptions;
  state.bedReferences.position.set(options.centerX, options.centerY, 0);
  const bedSignature = [
    options.width,
    options.depth,
    options.height,
    options.interval,
    options.heightGuideVisible,
    options.centerX,
    options.centerY,
    options.minorColor,
    options.axisColor,
    options.heightColor,
  ].join(':');
  if (state.bedSignature !== bedSignature) {
    replaceGeometry(
      state.bedOutline,
      buildVolumeOutlineGeometry(options.width, options.depth),
    );
    state.heightGuide.visible = options.heightGuideVisible;
    if (options.heightGuideVisible) {
      replaceGeometry(
        state.heightGuide,
        heightGuideGeometry(
          options.width,
          options.depth,
          options.height,
          options.interval,
          new THREE.Color(options.heightColor ?? HEIGHT_GUIDE_COLOR),
        ),
      );
    }
    state.bedSignature = bedSignature;
  }

  configureMaterial(state.lines.material, options.opacity);
  configureMaterial(state.bedOutline.material, options.opacity);
  configureMaterial(state.heightGuide.material, options.opacity);
  if (state.interval !== options.interval) {
    state.interval = options.interval;
    state.bounds = paddedWorldGridBounds(
      {
        minX: -options.width,
        maxX: options.width,
        minY: -options.depth,
        maxY: options.depth,
      },
      options.interval,
    );
    rebuildWorldGrid(state, options.interval);
  }
}

/** Expands the visible grid to follow the camera without drawing coordinate labels. */
export function updateGroundGridForView(
  grid: THREE.Group,
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  viewportHeight: number,
): void {
  const state = groundGridStates.get(grid);
  if (!state || !state.options.visible) return;

  const viewBounds = worldGridViewBounds(camera, target);
  const { interval } = worldGridIntervalForView(
    camera,
    target,
    viewportHeight,
    state.options.interval,
  );
  if (
    interval !== state.interval ||
    !containsViewWithMargin(state.bounds, viewBounds)
  ) {
    state.interval = interval;
    state.bounds = paddedWorldGridBounds(viewBounds, interval);
    rebuildWorldGrid(state, interval);
  }

}

/** Releases grid and build-volume resources held by the viewport. */
export function disposeGroundGrid(grid: THREE.Group): void {
  const state = groundGridStates.get(grid);
  if (!state) return;
  for (const object of [state.lines, state.bedOutline, state.heightGuide]) {
    object.geometry.dispose();
    disposeMaterial(object.material);
  }
  groundGridStates.delete(grid);
}

/** Replaces line geometry and releases its previous GPU buffer. */
function replaceGeometry(
  lines: THREE.LineSegments,
  geometry: THREE.BufferGeometry,
): void {
  lines.geometry.dispose();
  lines.geometry = geometry;
}

/** Rebuilds origin-aligned world lines for the current camera bounds. */
function rebuildWorldGrid(state: GroundGridState, interval: number): void {
  const palette = {
    minor: new THREE.Color(state.options.minorColor ?? GRID_MINOR_COLOR),
    major: new THREE.Color(state.options.axisColor ?? GRID_MAJOR_COLOR),
    axis: new THREE.Color(state.options.axisColor ?? GRID_AXIS_COLOR),
  };
  if (state.lines.geometry.getAttribute('position') === undefined) {
    state.lines.geometry.dispose();
    state.lines.geometry = infiniteWorldGridGeometry(
      state.bounds,
      interval,
      palette,
    );
    return;
  }
  updateInfiniteWorldGrid(state.lines, state.bounds, interval, palette);
}

/** Keeps the camera footprint away from the finite geometry's outer edge. */
function containsViewWithMargin(
  outer: WorldGridBounds,
  view: WorldGridBounds,
): boolean {
  const marginX = (outer.maxX - outer.minX) * 0.08;
  const marginY = (outer.maxY - outer.minY) * 0.08;
  return (
    view.minX >= outer.minX + marginX &&
    view.maxX <= outer.maxX - marginX &&
    view.minY >= outer.minY + marginY &&
    view.maxY <= outer.maxY - marginY
  );
}

/** Applies transparency consistently to every member of an object material. */
function configureMaterial(
  material: THREE.Material | THREE.Material[],
  opacity: number,
): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.transparent = true;
    item.opacity = opacity;
    item.depthWrite = false;
    item.toneMapped = false;
  }
}

/** Releases each material owned by a grid reference object. */
function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material])
    item.dispose();
}
