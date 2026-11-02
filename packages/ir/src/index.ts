/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for IR package.
 * @last-edited October 6, 2026
 */

export * from './ast/ast.js';
export * from './shared/ir.js';
export * from './shared/mesh-presentation.js';
export * from './geometry/radial.js';
export * from './geometry/solidPrimitives.js';
export * from './materials/materials.js';
export * from './sketch/sketchPreview.js';
export * from './sketch/sketchPreviewGeometry.js';
export * from './sketch/profileSelection.js';
export * from './drawing/drawing.js';
export * from './geometry/surface.js';
export * from './geometry/geometry.js';
export * from './shared/occtTrace.js';
export * from './references/reference-syntax.js';
export * from './references/reference-expansion.js';
export * from './references/resolved-selection.js';
export * from './geometry/profileRegions.js';
export * from './geometry/profileContainment.js';
export * from './geometry/atomicRegions.js';
export * from './geometry/atomic-region-arrangement.js';
export * from './geometry/arcSampling.js';
export * from './geometry/circularArcLoop.js';
export * from './geometry/compactPathPrimitiveSegments.js';
export * from './geometry/ellipseGeometry.js';
export * from './geometry/conicIntersections.js';
export * from './geometry/wrapLineSegments.js';
export * from './geometry/wrapOutline.js';
export * from './geometry/wrapProfileSegments.js';
export * from './geometry/wrapRoundedCorners.js';
export * from './geometry/wrapTypes.js';
export * from './shared/uniqueNames.js';
export * from './metadata/interaction-provenance.js';
export * from './metadata/interaction-ids.js';
export * from './metadata/interaction-lookup.js';
export * from './metadata/interaction-source-links.js';
export * from './metadata/interaction-source-spans.js';
export * from './metadata/interaction-snapshot-validation.js';
export * from './metadata/interaction-value-preview.js';
export * from './metadata/sketch-instances.js';
export * from './metadata/timeline.js';
export * from './pipeline/compilation-graph.js';
export * from './pipeline/prepared-component.js';
export * from './pipeline/native-boolean-batch.js';
