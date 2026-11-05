/**
 * @author Aidan Boissonneault
 * @file ir-core.ts
 * @purpose Provides IR core behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from '../sketch/sketchIr.js';

// Intermediate Representation — the contract between evaluator and OCCT bridge.
// Everything above this is language design; everything below is geometry engineering.
// Loops, conditionals, and variables do not exist in IR — the evaluator unrolls all of them.

/**
 * Source span, including file, source line, source column, end line, and end col.
 */
export type SourceSpan = {
  file: string;
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
};

/**
 * Compile error, including message and span.
 */
export type CompileError = {
  message: string;
  span: SourceSpan;
};

/**
 * Accepted values for workplane are 'XY', 'XZ', and 'YZ'.
 */
export type Workplane = 'XY' | 'XZ' | 'YZ';

/**
 * Accepted values for material texture are 'printed-plastic', 'fdm-layer', 'matte', 'satin',
 * 'gloss', 'silk', 'translucent', 'clear', 'rubber', 'powder', 'fiber', 'wood', 'metal',
 * 'marble', 'glitter', and 'glow'.
 */
export type MaterialTexture =
  | 'printed-plastic'
  | 'fdm-layer'
  | 'matte'
  | 'satin'
  | 'gloss'
  | 'silk'
  | 'translucent'
  | 'clear'
  | 'rubber'
  | 'powder'
  | 'fiber'
  | 'wood'
  | 'metal'
  | 'marble'
  | 'glitter'
  | 'glow';

/**
 * Material appearance, including identifier, name, color, texture, and roughness.
 */
export type MaterialAppearance = {
  id: string;
  name: string;
  color: string;
  texture: MaterialTexture;
  roughness: number;
  metalness: number;
  opacity?: number;
  reflectivity?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
  transmission?: number;
  ior?: number;
  thickness?: number;
  envMapIntensity?: number;
};

/**
 * Material assignment, including target and material.
 */
export type MaterialAssignment = {
  target: string;
  material: MaterialAppearance;
};

/**
 * Context for material, including assignments and catalog.
 */
export type MaterialContext = {
  assignments: MaterialAssignment[];
  catalog: MaterialAppearance[];
};

// Face references remain symbolic in IR — the OCCT bridge resolves them against
// the face label map it maintains as it processes each op.
// Format: "objName.faceName[.subRef]"  e.g. "base.top.edges", "pocket.side.front"
/**
 * Text value used for ir face label.
 */
export type IRFaceLabel = string;

/**
 * Ir font ref accepts string and { kind: 'fontAsset'; name: string; sourcePath: str.
 */
export type IRFontRef =
  | string
  | {
      kind: 'fontAsset';
      name: string;
      sourcePath: string;
      fsPath: string;
    };

/**
 * Ir font asset, including name, source path, fs path, and data.
 */
export type IRFontAsset = {
  name: string;
  sourcePath: string;
  fsPath: string;
  data: Uint8Array;
};

/**
 * Ir shape asset, including name, source path, fs path, export format, and data.
 */
export type IRShapeAsset = {
  name: string;
  sourcePath: string;
  fsPath: string;
  format: 'step' | 'stl';
  data: Uint8Array;
};

/**
 * Compile assets, including fonts and shapes.
 */
export type CompileAssets = {
  fonts: IRFontAsset[];
  shapes: IRShapeAsset[];
};

// Placement descriptor — anchor resolved to a named face + concrete numeric offsets.
// The faceRef string is looked up by the OCCT bridge in its label map.
/**
 * Ir placement, including face ref, selection, anchor ref, anchor, and offset x.
 */
export type IRPlacement = {
  faceRef: IRFaceLabel; // e.g. "base.top.center", "base.top.corner.front_left"
  workplane?: Workplane; // frame for built-in @origin placements
  selection?: import('../references/resolved-selection.js').ResolvedSelection;
  anchorRef?: IRFaceLabel; // component anchor snapped to faceRef, e.g. "bracket_0.bottom.center"
  anchor?: {
    ref: IRFaceLabel;
    localPoint: [number, number, number];
    localNormal: [number, number, number];
  };
  offsetX?: number; // resolved in base units (mm)
  offsetY?: number;
  offsetZ?: number; // distance along face normal — used by named planes
  radius?: number; // radial placement
  angleDeg?: number;
  surfaceAngleDeg?: number;
  rotationDeg?: number; // rotation around the resolved placement normal
  axisRotationDeg?: {
    x?: number;
    y?: number;
    z?: number;
  };
};

// IR ops

/**
 * Ir sketch, including operation kind, name, primitive, placement, and surface bound.
 */
export type IRSketch = {
  kind: 'sketch';
  name: string;
  primitive: IRPrimitive;
  // Where to draw the sketch. null = default XY origin plane.
  placement: IRPlacement | null;
  // Surface-bound sketches are clipped to this face when consumed.
  surfaceBound?: IRPlacement | null;
  span: SourceSpan;
};

// Source span + original literal text of an editable arg. `literal` is the
// exact source token (`"24"` or `"auto"`) so the timeline can seed its editor.
/**
 * Ir param span, including span and literal.
 */
export type IRParamSpan = { span: SourceSpan; literal: string };

// Editable args keyed by name. Present only when the arg was a direct numeric
// literal or the `auto` keyword — the timeline uses these for in-place edits.
/**
 * Lookup from string keys to IRParamSpan values.
 */
export type IRParamSpans = Record<string, IRParamSpan>;
