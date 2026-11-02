/**
 * @author Aidan Boissonneault
 * @file sketch-instance-overlay.ts
 * @purpose Provides sketch instance overlay behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type {
  InteractionSketchDefinition,
  InteractionSketchInstance,
  InteractionSnapshot,
  IRPrimitive,
} from '@bushscad/ir';
import {
  MODEL_HIGHLIGHT_CHANNEL_PRIORITY,
  type ModelHighlightChannel,
  type ModelHighlightChannels,
  type ModelHighlightTheme,
} from '../scene/model-highlight-layer.js';
import {
  createSketchOverlayBuffers,
  disposeSketchOverlayBuffers,
  populateSketchInstanceGroup,
  type SketchOverlayBuffers,
} from './sketch-overlay-presentation.js';

/**
 * Defines the `PartAttachment` callback contract used by the sketch preview layer.
 */
type PartAttachment = (partName: string) => THREE.Group | null;

/** Owns selected 3D sketch instances independently from solid mesh rebuilds. */
export class SketchInstanceOverlay {
  private readonly definitions = new Map<string, InteractionSketchDefinition>();
  private instances: readonly InteractionSketchInstance[] = [];
  private readonly buffers = new Map<string, SketchOverlayBuffers>();
  private readonly groups: THREE.Group[] = [];
  private channels: ModelHighlightChannels = {};
  private theme: ModelHighlightTheme;

  /**
   * Initializes the `SketchInstanceOverlay` instance with the values supplied by its caller.
   */
  constructor(
    private readonly attachment: PartAttachment,
    initialTheme: ModelHighlightTheme,
  ) {
    this.theme = initialTheme;
  }

  /**
   * Sets snapshot on the owning state.
   */
  setSnapshot(snapshot: InteractionSnapshot | null): void {
    this.clearGroups();
    this.disposeBuffers();
    this.definitions.clear();
    for (const definition of snapshot?.sketchDefinitions ?? []) {
      this.definitions.set(definition.id, definition);
    }
    this.instances = snapshot?.sketchInstances ?? [];
    this.rebuild();
  }

  /**
   * Sets channels on the owning state.
   */
  setChannels(channels: ModelHighlightChannels): void {
    this.replacePresentation(channels, this.theme);
  }

  /**
   * Sets theme on the owning state.
   */
  setTheme(theme: ModelHighlightTheme): void {
    this.replacePresentation(this.channels, theme);
  }

  /** Reattaches instances after the model scene recreates its part hierarchy. */
  refreshAttachments(): void {
    this.rebuild();
  }

  /** Replaces shared local geometry only when the revision is newer. */
  updateSketchDefinition(
    sketchId: string,
    revision: number,
    primitive: IRPrimitive,
  ): boolean {
    const current = this.definitions.get(sketchId);
    if (!current || revision <= current.revision) return false;
    this.definitions.set(sketchId, { ...current, revision, primitive });
    this.disposeDefinitionBuffers(sketchId);
    this.rebuild();
    return true;
  }

  /** Replaces only one definition's transforms without touching model meshes. */
  updateSketchInstances(
    sketchId: string,
    instances: readonly InteractionSketchInstance[],
    revision = this.definitions.get(sketchId)?.revision,
  ): boolean {
    const definition = this.definitions.get(sketchId);
    if (!definition || revision !== definition.revision) return false;
    if (instances.some((instance) => instance.definitionId !== sketchId)) {
      return false;
    }
    this.instances = [
      ...this.instances.filter(
        (instance) => instance.definitionId !== sketchId,
      ),
      ...instances,
    ];
    this.rebuild();
    return true;
  }

  /**
   * Removes sketch definition from its owning collection.
   */
  removeSketchDefinition(sketchId: string): void {
    this.definitions.delete(sketchId);
    this.instances = this.instances.filter(
      (instance) => instance.definitionId !== sketchId,
    );
    this.disposeDefinitionBuffers(sketchId);
    this.rebuild();
  }

  /**
   * Handles interactive objects in the sketch preview flow.
   */
  interactiveObjects(): readonly THREE.Object3D[] {
    return this.groups.flatMap((group) => group.children);
  }

  /**
   * Calculates the bounds of the supplied geometry.
   */
  boundsForTargets(targetIds: readonly string[]): THREE.Box3 | null {
    const requested = new Set(targetIds);
    const bounds = new THREE.Box3();
    for (const group of this.groups) {
      if (!instanceSelected(group, requested)) continue;
      group.parent?.updateWorldMatrix(true, false);
      bounds.expandByObject(group);
    }
    return bounds.isEmpty() ? null : bounds;
  }

  /**
   * Handles detach in the sketch preview flow.
   */
  detach(): void {
    this.clearGroups();
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.clearGroups();
    this.disposeBuffers();
    this.definitions.clear();
    this.instances = [];
  }

  /**
   * Handles rebuild in the sketch preview flow.
   */
  private rebuild(): void {
    this.clearGroups();
    for (const instance of this.instances) {
      const definition = this.definitions.get(instance.definitionId);
      const channel = definition
        ? selectedChannel(this.channels, definition, instance)
        : null;
      const parent = this.attachment(instance.partName);
      if (!definition || !channel || !parent || !instance.transform) continue;
      const group = this.createInstanceGroup(
        definition,
        instance,
        this.theme[channel],
      );
      parent.add(group);
      this.groups.push(group);
    }
  }

  /**
   * Handles replace presentation in the sketch preview flow.
   */
  private replacePresentation(
    channels: ModelHighlightChannels,
    theme: ModelHighlightTheme,
  ): void {
    this.channels = channels;
    this.theme = theme;
    this.rebuild();
  }

  /**
   * Creates instance group with the supplied values.
   */
  private createInstanceGroup(
    definition: InteractionSketchDefinition,
    instance: InteractionSketchInstance,
    color: string,
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = '__bushscad_sketch_instance';
    group.matrix.fromArray([...instance.transform!]);
    group.matrixAutoUpdate = false;
    Object.assign(group.userData, {
      interactionSketchInstanceId: instance.id,
      sketchDefinitionId: definition.id,
      sketchEntityIds: definition.entityIds,
      sketchPartEntityId: instance.partEntityId,
      sketchUnsupportedReason: instance.unsupportedReason,
    });
    const buffers = this.definitionBuffers(definition);
    populateSketchInstanceGroup(
      group,
      buffers,
      color,
      Boolean(instance.unsupportedReason),
    );
    return group;
  }

  /**
   * Handles definition buffers in the sketch preview flow.
   */
  private definitionBuffers(
    definition: InteractionSketchDefinition,
  ): SketchOverlayBuffers {
    const existing = this.buffers.get(definition.id);
    if (existing) return existing;
    const buffers = createSketchOverlayBuffers(definition.primitive);
    this.buffers.set(definition.id, buffers);
    return buffers;
  }

  /**
   * Clears groups while retaining the owning state.
   */
  private clearGroups(): void {
    for (const group of this.groups) {
      group.removeFromParent();
      group.traverse((object) => {
        const material = (object as THREE.LineSegments).material;
        if (material && !Array.isArray(material)) material.dispose();
        if (object.userData.ownedSketchCueGeometry) {
          (object as THREE.LineSegments).geometry.dispose();
        }
      });
    }
    this.groups.length = 0;
  }

  /**
   * Releases the definition buffers held by this object.
   */
  private disposeDefinitionBuffers(sketchId: string): void {
    const buffers = this.buffers.get(sketchId);
    if (!buffers) return;
    disposeSketchOverlayBuffers(buffers);
    this.buffers.delete(sketchId);
  }

  /**
   * Releases the buffers held by this object.
   */
  private disposeBuffers(): void {
    for (const id of [...this.buffers.keys()])
      this.disposeDefinitionBuffers(id);
  }
}

/**
 * Returns the selected channel from the current operation.
 */
function selectedChannel(
  channels: ModelHighlightChannels,
  definition: InteractionSketchDefinition,
  instance: InteractionSketchInstance,
): ModelHighlightChannel | null {
  const ids = new Set([definition.id, instance.id, ...definition.entityIds]);
  return (
    MODEL_HIGHLIGHT_CHANNEL_PRIORITY.find((channel) =>
      (channels[channel] ?? []).some((id) => ids.has(id)),
    ) ?? null
  );
}

/**
 * Handles instance selected in the sketch preview flow.
 */
function instanceSelected(group: THREE.Group, requested: Set<string>): boolean {
  return [
    group.userData.interactionSketchInstanceId,
    group.userData.sketchDefinitionId,
    ...(group.userData.sketchEntityIds ?? []),
  ].some((id) => requested.has(id));
}
