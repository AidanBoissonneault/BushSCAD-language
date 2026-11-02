/**
 * @author Aidan Boissonneault
 * @file model-interaction-presentation.ts
 * @purpose Provides model interaction presentation behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type {
  InteractionSketchInstance,
  InteractionSnapshot,
  IRPrimitive,
} from '@bushscad/ir';
import type { ModelScene } from '../core/model-scene.js';
import { SketchInstanceOverlay } from '../sketch-preview/sketch-instance-overlay.js';
import { combinedInteractionBounds } from './interaction-bounds.js';
import {
  DEFAULT_MODEL_HIGHLIGHT_THEME,
  ModelHighlightLayer,
  type ModelHighlightChannels,
  type ModelHighlightTheme,
} from './model-highlight-layer.js';

/** Coordinates topology highlights and selected sketch overlays around model rebuilds. */
export class ModelInteractionPresentation {
  private readonly highlights = new ModelHighlightLayer();
  private readonly sketches: SketchInstanceOverlay;

  /**
   * Initializes the `ModelInteractionPresentation` instance with the values supplied by its caller.
   */
  constructor(private readonly modelScene: ModelScene) {
    this.sketches = new SketchInstanceOverlay(
      (partName) => modelScene.partAttachment(partName),
      DEFAULT_MODEL_HIGHLIGHT_THEME,
    );
  }

  /**
   * Handles interactive objects in the scene flow.
   */
  interactiveObjects(): readonly THREE.Object3D[] {
    return [
      ...this.modelScene.interactiveMeshes(),
      ...this.sketches.interactiveObjects(),
    ];
  }

  /**
   * Sets snapshot on the owning state.
   */
  setSnapshot(snapshot: InteractionSnapshot | null): void {
    this.highlights.setSnapshot(snapshot);
    this.sketches.setSnapshot(snapshot);
  }

  /**
   * Sets channels on the owning state.
   */
  setChannels(channels: ModelHighlightChannels): void {
    this.highlights.setChannels(channels);
    this.sketches.setChannels(channels);
  }

  /**
   * Sets theme on the owning state.
   */
  setTheme(theme: ModelHighlightTheme): void {
    this.highlights.setTheme(theme);
    this.sketches.setTheme(theme);
  }

  /**
   * Prepares model rebuild for the next operation.
   */
  prepareModelRebuild(): void {
    this.highlights.setMeshes([]);
    this.sketches.detach();
  }

  /**
   * Handles complete model rebuild in the scene flow.
   */
  completeModelRebuild(): void {
    this.highlights.setMeshes(this.modelScene.interactiveMeshes());
    this.sketches.refreshAttachments();
  }

  /**
   * Sets viewport size on the owning state.
   */
  setViewportSize(width: number, height: number): void {
    this.highlights.setViewportSize(width, height);
  }

  /**
   * Calculates the bounds of the supplied geometry.
   */
  boundsForTargets(targetIds: readonly string[]): THREE.Box3 | null {
    return combinedInteractionBounds(
      this.highlights.boundsForTargets(targetIds),
      this.sketches.boundsForTargets(targetIds),
    );
  }

  /**
   * Updates sketch definition while preserving unrelated state.
   */
  updateSketchDefinition(
    sketchId: string,
    revision: number,
    primitive: IRPrimitive,
  ): boolean {
    return this.sketches.updateSketchDefinition(sketchId, revision, primitive);
  }

  /**
   * Updates sketch instances while preserving unrelated state.
   */
  updateSketchInstances(
    sketchId: string,
    instances: readonly InteractionSketchInstance[],
    revision?: number,
  ): boolean {
    return this.sketches.updateSketchInstances(sketchId, instances, revision);
  }

  /**
   * Removes sketch definition from its owning collection.
   */
  removeSketchDefinition(sketchId: string): void {
    this.sketches.removeSketchDefinition(sketchId);
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.highlights.dispose();
    this.sketches.dispose();
  }
}
