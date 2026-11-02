/**
 * @author Aidan Boissonneault
 * @file model-scene.ts
 * @purpose Provides model scene behavior for the core in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { MeshData } from '@bushscad/ir';
import {
  createOpenSurfaceMaterial,
  createPreviewMaterial,
  type RenderingStyle,
} from '../materials/materials.js';
import {
  createCadEdgeOverlay,
  disposeMeshGroup,
  MESH_PALETTE,
  resolvedMeshColor,
} from './mesh-rendering.js';
import { bodyRenderGroupKey } from '../parts/render-group-keys.js';
import type { PartLayoutOffset } from './plate-layout.js';
import { applyPartGroupLayout } from './part-group-layout.js';

/** Owns compiler model meshes and their part/body scene hierarchy. */
export class ModelScene {
  readonly group = new THREE.Group();
  private readonly partGroups = new Map<string, THREE.Group>();
  private readonly bodyGroups = new Map<string, THREE.Group>();
  private readonly partExplodeGroups = new Map<string, THREE.Group>();
  private readonly previewMeshes: THREE.Mesh[] = [];
  private explodePartSet: Set<string> | null = null;
  private platePartOffsets: ReadonlyMap<string, PartLayoutOffset> | null = null;
  private renderingStyle: RenderingStyle = 'cad';
  private currentMeshes: MeshData[] = [];
  private sourceMeshIndices: readonly (number | null)[] = [];
  private defaultMeshPalette: readonly string[] = MESH_PALETTE;

  /** Rebuilds displayed meshes while retaining explicit compiler mesh IDs. */
  updateMeshes(
    meshes: MeshData[],
    sourceMeshIndices?: readonly (number | null)[],
  ): void {
    this.currentMeshes = meshes;
    this.sourceMeshIndices =
      sourceMeshIndices ?? meshes.map((_mesh, index) => index);
    disposeMeshGroup(this.group);
    this.group.clear();
    this.partGroups.clear();
    this.bodyGroups.clear();
    this.partExplodeGroups.clear();
    this.previewMeshes.length = 0;
    meshes.forEach((mesh, index) => this.addMesh(mesh, index));
    this.applyLayout();
  }

  /** Returns only model meshes with provenance, excluding every scene helper. */
  interactiveMeshes(): readonly THREE.Mesh[] {
    return this.previewMeshes.filter((mesh) =>
      Number.isInteger(mesh.userData.interactionMeshIndex),
    );
  }

  /** Returns the transform-owning group used by overlays for one part. */
  partAttachment(partName: string): THREE.Group | null {
    return this.partGroups.get(partName) ?? this.uniqueBodyGroup(partName);
  }

  /**
   * Sets rendering style on the owning state.
   */
  setRenderingStyle(style: RenderingStyle): void {
    if (this.renderingStyle === style) return;
    this.renderingStyle = style;
    this.updateMeshes(this.currentMeshes, this.sourceMeshIndices);
  }

  /** Recolors only meshes that use the application-controlled palette. */
  setDefaultMeshPalette(palette: readonly string[]): void {
    this.defaultMeshPalette = palette.length > 0 ? [...palette] : MESH_PALETTE;
    if (this.currentMeshes.length > 0) {
      this.updateMeshes(this.currentMeshes, this.sourceMeshIndices);
    }
  }

  /**
   * Sets explode parts on the owning state.
   */
  setExplodeParts(partsToSpread: Set<string> | null): void {
    this.explodePartSet = partsToSpread;
    this.applyLayout();
  }

  /**
   * Sets plate part offsets on the owning state.
   */
  setPlatePartOffsets(
    offsets: ReadonlyMap<string, PartLayoutOffset> | null,
  ): void {
    this.platePartOffsets = offsets;
    this.applyLayout();
  }

  /**
   * Applies joint transform to the supplied state or geometry.
   */
  applyJointTransform(
    partName: string,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): void {
    const target =
      this.partGroups.get(partName) ?? this.uniqueBodyGroup(partName);
    if (!target) return;
    target.position.copy(position);
    target.quaternion.copy(quaternion);
  }

  /**
   * Resets joint transforms to its initial state.
   */
  resetJointTransforms(): void {
    for (const group of this.partGroups.values()) resetGroupTransform(group);
    for (const group of this.bodyGroups.values()) resetGroupTransform(group);
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    disposeMeshGroup(this.group);
    this.group.clear();
    this.previewMeshes.length = 0;
  }

  /**
   * Adds mesh to its owning collection.
   */
  private addMesh(mesh: MeshData, index: number): void {
    const partGroup = this.ensurePartGroup(mesh.partName);
    const targetGroup = this.targetGroupForMesh(mesh, partGroup);
    const previewMesh = this.createPreviewMesh(mesh, index);
    targetGroup.add(previewMesh);
    this.previewMeshes.push(previewMesh);
  }

  /**
   * Handles ensure part group in the core flow.
   */
  private ensurePartGroup(partName: string): THREE.Group {
    let partGroup = this.partGroups.get(partName);
    if (partGroup) return partGroup;
    const explodeGroup = new THREE.Group();
    explodeGroup.name = `${partName}__explode`;
    this.group.add(explodeGroup);
    this.partExplodeGroups.set(partName, explodeGroup);
    partGroup = new THREE.Group();
    partGroup.name = partName;
    explodeGroup.add(partGroup);
    this.partGroups.set(partName, partGroup);
    return partGroup;
  }

  /**
   * Handles target group for mesh in the core flow.
   */
  private targetGroupForMesh(
    mesh: MeshData,
    partGroup: THREE.Group,
  ): THREE.Group {
    if (!mesh.bodyName || mesh.bodyName === mesh.partName) return partGroup;
    const key = bodyRenderGroupKey(mesh.partName, mesh.bodyName);
    let bodyGroup = this.bodyGroups.get(key);
    if (bodyGroup) return bodyGroup;
    bodyGroup = new THREE.Group();
    bodyGroup.name = mesh.bodyName;
    partGroup.add(bodyGroup);
    this.bodyGroups.set(key, bodyGroup);
    return bodyGroup;
  }

  /**
   * Creates preview mesh with the supplied values.
   */
  private createPreviewMesh(mesh: MeshData, index: number): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(mesh.vertices, 3),
    );
    geometry.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    const color = resolvedMeshColor(mesh, index, this.defaultMeshPalette);
    const material = mesh.isOpenSurface
      ? createOpenSurfaceMaterial(mesh.material, color, this.renderingStyle)
      : createPreviewMaterial(mesh.material, color, this.renderingStyle);
    const previewMesh = new THREE.Mesh(geometry, material);
    const sourceMeshIndex = this.sourceMeshIndices[index];
    if (sourceMeshIndex !== null && sourceMeshIndex !== undefined) {
      previewMesh.userData.interactionMeshIndex = sourceMeshIndex;
    }
    previewMesh.castShadow =
      this.renderingStyle === 'realism' && !mesh.isOpenSurface;
    previewMesh.receiveShadow =
      this.renderingStyle === 'realism' && !mesh.isOpenSurface;
    if (this.renderingStyle === 'cad' && !mesh.isOpenSurface) {
      previewMesh.add(createCadEdgeOverlay(geometry));
    }
    return previewMesh;
  }

  /**
   * Applies layout to the supplied state or geometry.
   */
  private applyLayout(): void {
    applyPartGroupLayout(this.partExplodeGroups, {
      explodedParts: this.explodePartSet,
      plateOffsets: this.platePartOffsets,
      gapMm: 10,
    });
  }

  /**
   * Removes duplicate body group values while preserving their first occurrence.
   */
  private uniqueBodyGroup(bodyName: string): THREE.Group | null {
    let match: THREE.Group | null = null;
    for (const [key, group] of this.bodyGroups) {
      if (!key.endsWith(`\u0000${bodyName}`)) continue;
      if (match) return null;
      match = group;
    }
    return match;
  }
}

/**
 * Resets group transform to its initial state.
 */
function resetGroupTransform(group: THREE.Group): void {
  group.position.set(0, 0, 0);
  group.quaternion.identity();
}
