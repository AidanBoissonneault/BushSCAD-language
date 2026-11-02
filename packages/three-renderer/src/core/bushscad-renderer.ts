/**
 * @author Aidan Boissonneault
 * @file bushscad-renderer.ts
 * @purpose Provides bushscad renderer behavior for the core in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type {
  InteractionSketchInstance,
  InteractionSnapshot,
  IRPrimitive,
  MeshData,
} from '@bushscad/ir';
import { GizmoRenderer } from '../scene/gizmo.js';
import type { RenderingStyle } from '../materials/materials.js';
import {
  ViewportReferenceScene,
  type CenterPlaneGimbalOptions,
  type GroundGridOptions,
  type SceneSideLabelOptions,
} from '../scene/viewport-reference-scene.js';
import { StudioLighting } from '../materials/studio-lighting.js';
import type { PartLayoutOffset } from './plate-layout.js';
import { ModelScene } from './model-scene.js';
import {
  ModelPointerController,
  type ModelPointerCallbacks,
} from '../scene/model-pointer-controller.js';
import { CameraNavigation } from '../scene/camera-navigation.js';
import type {
  ModelHighlightChannels,
  ModelHighlightTheme,
} from '../scene/model-highlight-layer.js';
import type { CameraFocusOptions } from '../scene/camera-focus.js';
import { RendererFrameLoop, renderFrame } from './renderer-frame-loop.js';
import { ModelInteractionPresentation } from '../scene/model-interaction-presentation.js';
import {
  createRendererSurface,
  createViewportControls,
} from './renderer-surface.js';

/**
 * Owns the Three.js viewport surface, model scene, camera, controls, interaction
 * presentation, guides, lighting, and frame loop for one host canvas.
 */
export class BushSCADRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private cameraNavigation: CameraNavigation;
  private modelScene: ModelScene;
  private modelInteraction: ModelInteractionPresentation;
  private modelPointer: ModelPointerController;
  private interactionSnapshot: InteractionSnapshot | null = null;
  private viewportReferences: ViewportReferenceScene;
  private studio: StudioLighting;
  private frameLoop: RendererFrameLoop;
  private gizmo: GizmoRenderer | null = null;
  private onCameraChange: (() => void) | null = null;
  private renderingStyle: RenderingStyle = 'cad';
  private readonly onControlsEnd = (): void => this.onCameraChange?.();

  /**
   * Initializes the `BushSCADRenderer` instance with the values supplied by its caller.
   */
  constructor(canvas: HTMLCanvasElement) {
    const surface = createRendererSurface(canvas);
    this.scene = surface.scene;
    this.camera = surface.camera;
    this.renderer = surface.renderer;
    this.studio = new StudioLighting(this.scene, this.renderer);

    this.modelScene = new ModelScene();
    this.scene.add(this.modelScene.group);
    this.modelInteraction = new ModelInteractionPresentation(this.modelScene);
    this.modelPointer = new ModelPointerController(
      canvas,
      this.camera,
      () => this.modelInteraction.interactiveObjects(),
      () => this.interactionSnapshot,
    );

    this.controls = createViewportControls(this.camera, canvas);
    this.controls.addEventListener('end', this.onControlsEnd);
    this.cameraNavigation = new CameraNavigation(
      this.camera,
      this.controls,
      this.modelScene.group,
      () => this.onCameraChange?.(),
    );

    this.viewportReferences = new ViewportReferenceScene(this.scene);
    this.frameLoop = new RendererFrameLoop(canvas, {
      resize: (width, height) => this.resize(width, height),
      render: () =>
        renderFrame(
          this.renderer,
          this.scene,
          this.camera,
          this.controls,
          this.gizmo,
          () =>
            this.viewportReferences.updateGroundGridForView(
              this.camera,
              this.controls.target,
              canvas.clientHeight,
            ),
        ),
    });
  }

  /**
   * Sets gizmo on the owning state.
   */
  setGizmo(gizmo: GizmoRenderer | null): void {
    this.gizmo = gizmo;
  }

  /**
   * Sets axis viewer visible on the owning state.
   */
  setAxisViewerVisible(visible: boolean): void {
    this.viewportReferences.setAxisVisible(visible);
  }

  /** Applies the saved center-axis viewer presentation without rebuilding it. */
  setAxisViewerOptions(options: CenterPlaneGimbalOptions): void {
    this.viewportReferences.setAxisOptions(options);
  }

  /** Controls the ground reference independently from the center-axis viewer. */
  setGroundGridOptions(options: GroundGridOptions): void {
    this.viewportReferences.setGroundOptions(options);
  }

  /** Applies visibility and placement for the six semantic scene-side names. */
  setSceneSideLabelOptions(options: SceneSideLabelOptions): void {
    this.viewportReferences.setSideLabelOptions(options);
    this.updateModelBounds();
  }

  /**
   * Sets camera change callback on the owning state.
   */
  setCameraChangeCallback(callback: (() => void) | null): void {
    this.onCameraChange = callback;
  }

  /**
   * Sets model pointer callbacks on the owning state.
   */
  setModelPointerCallbacks(callbacks: ModelPointerCallbacks): void {
    this.modelPointer.setCallbacks(callbacks);
  }

  /**
   * Sets interaction snapshot on the owning state.
   */
  setInteractionSnapshot(snapshot: InteractionSnapshot | null): void {
    this.interactionSnapshot = snapshot;
    this.cameraNavigation.cancelFocus();
    this.modelInteraction.setSnapshot(snapshot);
  }

  /**
   * Sets highlight channels on the owning state.
   */
  setHighlightChannels(channels: ModelHighlightChannels): void {
    this.modelInteraction.setChannels(channels);
  }

  /**
   * Sets highlight theme on the owning state.
   */
  setHighlightTheme(theme: ModelHighlightTheme): void {
    this.modelInteraction.setTheme(theme);
  }

  /** Centers explicit world bounds while preserving camera direction. */
  focusEntity(bounds: THREE.Box3, options?: CameraFocusOptions): boolean {
    return this.cameraNavigation.focusEntity(bounds, options);
  }

  /** Resolves compiler topology IDs to aggregate bounds before focusing. */
  focusTargets(
    targetIds: readonly string[],
    options?: CameraFocusOptions,
  ): boolean {
    const bounds = this.modelInteraction.boundsForTargets(targetIds);
    return bounds ? this.focusEntity(bounds, options) : false;
  }

  /**
   * Cancels focus and restores the prior state.
   */
  cancelFocus(): void {
    this.cameraNavigation.cancelFocus();
  }

  /**
   * Sets rendering style on the owning state.
   */
  setRenderingStyle(style: RenderingStyle): void {
    if (this.renderingStyle === style) return;
    this.renderingStyle = style;
    this.studio.applyRenderingStyle(this.renderingStyle);
    this.modelInteraction.prepareModelRebuild();
    this.modelScene.setRenderingStyle(style);
    this.modelInteraction.completeModelRebuild();
    this.updateModelBounds();
  }

  /** Recolors auto-assigned bodies while leaving explicit material colors intact. */
  setDefaultMeshPalette(palette: readonly string[]): void {
    this.modelInteraction.prepareModelRebuild();
    this.modelScene.setDefaultMeshPalette(palette);
    this.modelInteraction.completeModelRebuild();
    this.updateModelBounds();
  }

  /**
   * Updates meshes while preserving unrelated state.
   */
  updateMeshes(
    meshes: MeshData[],
    sourceMeshIndices?: readonly (number | null)[],
  ): void {
    this.modelInteraction.prepareModelRebuild();
    this.modelScene.updateMeshes(meshes, sourceMeshIndices);
    this.modelInteraction.completeModelRebuild();
    this.updateModelBounds();
  }

  /**
   * Sets which parts get spread along +X. Pass `null` to disable separation
   * entirely (all parts at origin). Parts not in the set always render at
   * origin even if separation is otherwise active.
   */
  setExplodeParts(partsToSpread: Set<string> | null): void {
    this.modelScene.setExplodeParts(partsToSpread);
    this.updateModelBounds();
  }

  /** Applies a print-bed arrangement in place of the standard X-axis spread. */
  setPlatePartOffsets(
    offsets: ReadonlyMap<string, PartLayoutOffset> | null,
  ): void {
    this.modelScene.setPlatePartOffsets(offsets);
    this.updateModelBounds();
  }

  /**
   * Applies joint transform to the supplied state or geometry.
   */
  applyJointTransform(
    partName: string,
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): void {
    this.modelScene.applyJointTransform(partName, position, quaternion);
    this.viewportReferences.update(this.modelScene.group);
  }

  /**
   * Resets joint transforms to its initial state.
   */
  resetJointTransforms(): void {
    this.modelScene.resetJointTransforms();
    this.viewportReferences.update(this.modelScene.group);
  }

  /**
   * Updates sketch definition while preserving unrelated state.
   */
  updateSketchDefinition(
    sketchId: string,
    revision: number,
    primitive: IRPrimitive,
  ): boolean {
    return this.modelInteraction.updateSketchDefinition(
      sketchId,
      revision,
      primitive,
    );
  }

  /**
   * Updates sketch instances while preserving unrelated state.
   */
  updateSketchInstances(
    sketchId: string,
    instances: readonly InteractionSketchInstance[],
    revision?: number,
  ): boolean {
    return this.modelInteraction.updateSketchInstances(
      sketchId,
      instances,
      revision,
    );
  }

  /**
   * Removes sketch definition from its owning collection.
   */
  removeSketchDefinition(sketchId: string): void {
    this.modelInteraction.removeSketchDefinition(sketchId);
  }

  /**
   * Handles resize in the core flow.
   */
  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(width, height, false);
    this.modelInteraction.setViewportSize(width, height);
  }

  /**
   * Handles snap to direction in the core flow.
   */
  snapToDirection(dir: THREE.Vector3): void {
    this.cameraNavigation.snapToDirection(dir);
  }

  /**
   * Handles orbit to direction in the core flow.
   */
  orbitToDirection(dir: THREE.Vector3): void {
    this.cameraNavigation.orbitToDirection(dir);
  }

  /**
   * Handles home view in the core flow.
   */
  homeView(): void {
    this.cameraNavigation.homeView();
  }

  /**
   * Handles snap to in the core flow.
   */
  snapTo(
    direction: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right',
  ): void {
    this.cameraNavigation.snapTo(direction);
  }

  /**
   * Returns camera state from the supplied input.
   */
  getCameraState(): { position: THREE.Vector3; target: THREE.Vector3 } {
    return this.cameraNavigation.getState();
  }

  /**
   * Sets camera state on the owning state.
   */
  setCameraState(position: THREE.Vector3Like, target: THREE.Vector3Like): void {
    this.cameraNavigation.setState(position, target);
  }

  /**
   * Releases the owned resources held by this object.
   */
  dispose(): void {
    this.frameLoop.dispose();
    this.modelPointer.dispose();
    this.cameraNavigation.dispose();
    this.controls.removeEventListener('end', this.onControlsEnd);
    this.controls.dispose();
    this.modelInteraction.dispose();
    this.modelScene.dispose();
    this.studio.dispose();
    this.viewportReferences.dispose();
    this.renderer.dispose();
    this.gizmo?.dispose();
  }

  /**
   * Updates model bounds while preserving unrelated state.
   */
  private updateModelBounds(): void {
    this.studio.updateBounds(this.modelScene.group, this.renderingStyle);
    this.viewportReferences.update(this.modelScene.group);
  }
}
