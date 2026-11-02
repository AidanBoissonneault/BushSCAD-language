/**
 * @author Aidan Boissonneault
 * @file model-highlight-layer.ts
 * @purpose Provides model highlight layer behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type {
  InteractionMeshTopology,
  InteractionSnapshot,
} from '@bushscad/ir';
import {
  cornerPositions,
  createFaceHighlightGeometry,
  edgeSegmentPositions,
  includeHighlightBounds,
  selectHighlightTopology,
  type HighlightTopologySelection,
} from './highlight-geometry.js';
import { interactionMeshIndex } from './model-hit-testing.js';
import {
  addHighlightLineCue,
  createCornerHighlightPoints,
  createFaceHighlightMesh,
  disposeHighlightGroup,
  setHighlightLineResolution,
} from './highlight-objects.js';

/**
 * Named source or interaction state that can highlight model geometry.
 */
export type ModelHighlightChannel =
  | 'source-edit'
  | 'viewport-hover'
  | 'source-hover'
  | 'pinned'
  | 'sketch';

/**
 * Optional color-channel overrides for model highlights, keyed by supported highlight channels.
 */
export type ModelHighlightChannels = Partial<
  Readonly<Record<ModelHighlightChannel, readonly string[]>>
>;

/**
 * Immutable color assignments for each model-highlight channel, plus the point accent color.
 */
export type ModelHighlightTheme = Readonly<
  Record<ModelHighlightChannel, string> & { pointAccent: string }
>;

export const MODEL_HIGHLIGHT_CHANNEL_PRIORITY: readonly ModelHighlightChannel[] =
  ['pinned', 'source-hover', 'viewport-hover', 'source-edit', 'sketch'];

export const DEFAULT_MODEL_HIGHLIGHT_THEME: ModelHighlightTheme = {
  pinned: '#f472b6',
  'source-hover': '#22d3ee',
  'viewport-hover': '#fbbf24',
  'source-edit': '#60a5fa',
  sketch: '#a78bfa',
  pointAccent: '#ef4444',
};

/** Owns disposable highlight objects without changing visible model materials. */
export class ModelHighlightLayer {
  private snapshot: InteractionSnapshot | null = null;
  private meshes = new Map<number, THREE.Mesh>();
  private channels: ModelHighlightChannels = {};
  private theme: ModelHighlightTheme = DEFAULT_MODEL_HIGHLIGHT_THEME;
  private readonly attachedGroups: THREE.Group[] = [];
  private viewportWidth = 1;
  private viewportHeight = 1;

  /**
   * Sets snapshot on the owning state.
   */
  setSnapshot(snapshot: InteractionSnapshot | null): void {
    this.snapshot = snapshot;
    this.rebuild();
  }

  /**
   * Sets meshes on the owning state.
   */
  setMeshes(meshes: readonly THREE.Mesh[]): void {
    this.clearObjects();
    this.meshes = new Map(
      meshes.flatMap((mesh) => {
        const index = interactionMeshIndex(mesh);
        return index === null ? [] : ([[index, mesh]] as const);
      }),
    );
    this.rebuild();
  }

  /**
   * Sets channels on the owning state.
   */
  setChannels(channels: ModelHighlightChannels): void {
    this.channels = channels;
    this.rebuild();
  }

  /**
   * Sets theme on the owning state.
   */
  setTheme(theme: ModelHighlightTheme): void {
    this.theme = theme;
    this.rebuild();
  }

  /**
   * Sets viewport size on the owning state.
   */
  setViewportSize(width: number, height: number): void {
    this.viewportWidth = Math.max(1, width);
    this.viewportHeight = Math.max(1, height);
    for (const group of this.attachedGroups) {
      setHighlightLineResolution(
        group,
        this.viewportWidth,
        this.viewportHeight,
      );
    }
  }

  /** Returns aggregate world bounds for camera focus without creating objects. */
  boundsForTargets(targetIds: readonly string[]): THREE.Box3 | null {
    if (!this.snapshot || targetIds.length === 0) return null;
    const requested = new Set(targetIds);
    const bounds = new THREE.Box3();
    for (const topology of this.snapshot.topology) {
      const mesh = this.meshes.get(topology.meshIndex);
      if (!mesh) continue;
      const selection = selectHighlightTopology(topology, requested);
      includeHighlightBounds(bounds, mesh, selection);
    }
    return bounds.isEmpty() ? null : bounds;
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.clearObjects();
    this.meshes.clear();
    this.snapshot = null;
  }

  /**
   * Handles rebuild in the scene flow.
   */
  private rebuild(): void {
    this.clearObjects();
    if (!this.snapshot || this.meshes.size === 0) return;
    const claimed = new Set<string>();
    for (const channel of MODEL_HIGHLIGHT_CHANNEL_PRIORITY) {
      const targetIds = this.channels[channel] ?? [];
      if (targetIds.length === 0) continue;
      const requested = new Set(targetIds);
      for (const topology of this.snapshot.topology) {
        const mesh = this.meshes.get(topology.meshIndex);
        if (!mesh) continue;
        const selection = unclaimedSelection(
          topology,
          selectHighlightTopology(topology, requested),
          claimed,
        );
        this.attachSelection(
          mesh,
          selection,
          this.theme[channel],
          this.theme.pointAccent,
        );
      }
    }
  }

  /**
   * Attaches selection to its owning object.
   */
  private attachSelection(
    mesh: THREE.Mesh,
    selection: HighlightTopologySelection,
    color: string,
    pointAccent: string,
  ): void {
    if (selectionIsEmpty(selection)) return;
    const group = new THREE.Group();
    group.name = '__bushscad_model_highlight';
    group.userData.modelHighlightLayer = true;
    addFaceHighlights(group, mesh.geometry, selection, color);
    addEdgeHighlights(group, selection, color);
    addCornerHighlights(group, selection, color, pointAccent);
    if (selection.wholeMesh) addSilhouette(group, mesh.geometry, color);
    setHighlightLineResolution(group, this.viewportWidth, this.viewportHeight);
    mesh.add(group);
    this.attachedGroups.push(group);
  }

  /**
   * Clears objects while retaining the owning state.
   */
  private clearObjects(): void {
    for (const group of this.attachedGroups) {
      group.removeFromParent();
      disposeHighlightGroup(group);
    }
    this.attachedGroups.length = 0;
  }
}

/**
 * Handles selection is empty in the scene flow.
 */
function selectionIsEmpty(selection: HighlightTopologySelection): boolean {
  return (
    selection.faces.length === 0 &&
    selection.edges.length === 0 &&
    selection.corners.length === 0
  );
}

/**
 * Adds face highlights to its owning collection.
 */
function addFaceHighlights(
  group: THREE.Group,
  source: THREE.BufferGeometry,
  selection: HighlightTopologySelection,
  color: string,
): void {
  if (selection.wholeMesh) {
    group.add(createFaceHighlightMesh(source, color, false));
    return;
  }
  const geometry = createFaceHighlightGeometry(source, selection.faces);
  if (!geometry) return;
  group.add(createFaceHighlightMesh(geometry, color));
  addGeometryEdges(group, geometry, color, 2.5);
}

/**
 * Adds edge highlights to its owning collection.
 */
function addEdgeHighlights(
  group: THREE.Group,
  selection: HighlightTopologySelection,
  color: string,
): void {
  const positions = edgeSegmentPositions(selection.edges);
  if (positions.length > 0) addHighlightLineCue(group, positions, color, 2.5);
}

/**
 * Adds corner highlights to its owning collection.
 */
function addCornerHighlights(
  group: THREE.Group,
  selection: HighlightTopologySelection,
  color: string,
  pointAccent: string,
): void {
  const corners = selection.corners.filter(
    (point) => point.role !== 'reference-point',
  );
  const referencePoints = selection.corners.filter(
    (point) => point.role === 'reference-point',
  );
  const points = cornerPositions(corners);
  if (points.length > 0) group.add(createCornerHighlightPoints(points, color));
  const accents = cornerPositions(referencePoints);
  if (accents.length > 0) {
    group.add(createCornerHighlightPoints(accents, pointAccent, 11));
  }
}

/**
 * Adds silhouette to its owning collection.
 */
function addSilhouette(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: string,
): void {
  addGeometryEdges(group, geometry, color, 3.5);
}

/**
 * Adds geometry edges to its owning collection.
 */
function addGeometryEdges(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: string,
  width: number,
): void {
  const edges = new THREE.EdgesGeometry(geometry, 24);
  const positions = edges.getAttribute('position');
  if (positions) {
    addHighlightLineCue(group, new Float32Array(positions.array), color, width);
  }
  edges.dispose();
}

/**
 * Handles unclaimed selection in the scene flow.
 */
function unclaimedSelection(
  topology: InteractionMeshTopology,
  selection: HighlightTopologySelection,
  claimed: Set<string>,
): HighlightTopologySelection {
  /**
   * Handles key in the scene flow.
   */
  const key = (kind: string, id: string): string =>
    `${topology.meshIndex}:${kind}:${id}`;
  /**
   * Handles take in the scene flow.
   */
  const take = <T extends { readonly id: string }>(
    kind: string,
    values: readonly T[],
  ): T[] =>
    values.filter((value) => {
      const identity = key(kind, value.id);
      if (claimed.has(identity)) return false;
      claimed.add(identity);
      return true;
    });
  const faces = take('face', selection.faces);
  return {
    faces,
    edges: take('edge', selection.edges),
    corners: take('corner', selection.corners),
    wholeMesh: selection.wholeMesh && faces.length > 0,
  };
}
