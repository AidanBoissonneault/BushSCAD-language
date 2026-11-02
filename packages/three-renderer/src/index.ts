/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for three renderer package.
 * @last-edited October 6, 2026
 */

export { BushSCADRenderer } from './core/bushscad-renderer.js';
export type {
  ModelPointerCallbacks,
  ModelPointerPosition,
} from './scene/model-pointer-controller.js';
export type { ModelHit } from './scene/model-hit-testing.js';
export {
  modelTargetLabel,
  resolveModelNavigationTarget,
  type EditorSourceContext,
  type ModelNavigationTarget,
} from './scene/model-navigation-target.js';
export type { CameraFocusOptions } from './scene/camera-focus.js';
export {
  DEFAULT_MODEL_HIGHLIGHT_THEME,
  type ModelHighlightChannel,
  type ModelHighlightChannels,
  type ModelHighlightTheme,
} from './scene/model-highlight-layer.js';
export { GizmoRenderer } from './scene/gizmo.js';
export type {
  SceneSideLabelOptions,
  SceneSideLabelPlacementMode,
} from './scene/scene-side-labels.js';
export type { GroundGridOptions } from './scene/ground-grid.js';
export {
  DEFAULT_CENTER_PLANE_GIMBAL_OPTIONS,
  type CenterPlaneGimbalOptions,
  type CenterPlaneGimbalStyle,
} from './scene/center-plane-gimbal.js';
export { createPreviewMaterial } from './materials/materials.js';
export { computePartLayout } from './core/part-layout.js';
export {
  computePlateLayout,
  includeVerticesInPartBounds,
  type PartLayoutOffset,
  type PlatePartBounds,
} from './core/plate-layout.js';
export { originRootedParts } from './core/part-deps.js';
export {
  clampJointValue,
  jointPartTransforms,
  type JointPartTransform,
} from './parts/joint-transforms.js';
export { SketchPreviewRenderer } from './sketch-preview/sketch-preview.js';
export {
  compactSketchPreviewMeasure,
  importantSketchPreviewDetails,
  sketchPreviewConstraintState,
  sketchPreviewConstraintStatus,
  sketchPreviewDetails,
  sketchPreviewStats,
  type SketchPreviewStat,
  type SketchPreviewStatus,
  type SketchPreviewStatusTone,
} from './sketch-preview/sketch-preview-metadata.js';
export type { SketchPreviewModel } from '@bushscad/ir';
export type { RenderingStyle } from './materials/materials.js';
export type { IRPrimitive } from '@bushscad/ir';
