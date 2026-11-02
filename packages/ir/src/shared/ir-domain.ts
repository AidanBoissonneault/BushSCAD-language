/**
 * @author Aidan Boissonneault
 * @file ir-domain.ts
 * @purpose Provides IR domain behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

import type { IRPlacement, SourceSpan } from './ir-core.js';
import type { IRProfileSegment } from '../sketch/sketchIr.js';

// Manufacturing fits and tolerances

/**
 * Ir fit, including operation kind, fit kind, fit name, relation, and target name.
 */
export type IRFit = {
  kind: 'fit';
  fitKind: string; // 'clearance' | 'slip' | 'press' | 'interference' | 'loose' | 'tight'
  fitName: string; // symbolic name e.g. 'M3_bolt'
  relation: 'through' | 'into';
  targetName: string; // target geometry name e.g. 'mounting_hole'
  toleranceLevel: string; // 'normal' | 'tight' | 'loose'
  resolvedOffsetMm: number; // concrete mm offset from active process profile
  processProfile: string; // e.g. 'std.printing.fdm', or 'none'
  span: SourceSpan;
};

// Design validation

// An expression fragment that the OCCT bridge can evaluate against real shapes.
// Deliberately simpler than the full Expr AST — only what validation queries need.
/**
 * Ir assert expr is tagged by kind: 'literal' carries display value, 'query' carries fn, args,
 * and 'binary' carries op, left, right.
 */
export type IRAssertExpr =
  | { kind: 'literal'; value: number }
  | { kind: 'query'; fn: string; args: string[] } // fn = 'face_area' | 'volume' | etc., args = resolved IR names
  | {
      kind: 'binary';
      op: '+' | '-' | '*' | '/';
      left: IRAssertExpr;
      right: IRAssertExpr;
    };

/**
 * Ir assert, including operation kind, left, op, right, and severity.
 */
export type IRAssert = {
  kind: 'assert';
  left: IRAssertExpr;
  op: '>=' | '<=' | '>' | '<' | '==' | '!=';
  right: IRAssertExpr;
  severity: 'error' | 'warning';
  message: string | null;
  span: SourceSpan;
};

/**
 * Result of validation, including passed, severity, message, and span.
 */
export type ValidationResult = {
  passed: boolean;
  severity: 'error' | 'warning';
  message: string;
  span: SourceSpan;
};

/**
 * Ir hardware visual, including operation kind, hardware kind, obj name, diameter mm, and height
 * mm.
 */
export type IRHardwareVisual = {
  kind: 'hardware_visual';
  hardwareKind: 'bolt' | 'insert';
  objName: string;
  diameterMm: number;
  heightMm: number;
  headDiameterMm?: number; // bolt hex-head across-flats (bolt only)
  headHeightMm?: number; // bolt head height (bolt only)
  placement: IRPlacement;
  span: SourceSpan;
};

// Imported geometry

/**
 * Ir import shape, including operation kind, name, fs path, export format, and span.
 */
export type IRImportShape = {
  kind: 'importShape';
  name: string;
  fsPath: string;
  format: 'step' | 'stl';
  span: SourceSpan;
};

/**
 * Ir heal, including operation kind, target, tolerance, and span.
 */
export type IRHeal = {
  kind: 'heal';
  target: string;
  tolerance: number;
  span: SourceSpan;
};

/**
 * Ir defeature, including operation kind, target, feature type, threshold, and span.
 */
export type IRDefeature = {
  kind: 'defeature';
  target: string;
  featureType: 'holes' | 'pockets';
  threshold: number;
  span: SourceSpan;
};

/**
 * Ir ref, including operation kind, name, base name, and span.
 */
export type IRRef = {
  kind: 'ref';
  name: string;
  baseName: string;
  span: SourceSpan;
};

/**
 * Ir declare shape, including operation kind, name, and span.
 */
export type IRDeclareShape = {
  kind: 'declareShape';
  name: string;
  span: SourceSpan;
};

/**
 * Ir align shape, including operation kind, name, instance name, source ref, and target
 * placement.
 */
export type IRAlignShape = {
  kind: 'alignShape';
  name: string;
  instanceName: string;
  sourceRef: string | null;
  targetPlacement: IRPlacement;
  span: SourceSpan;
};

// Assemblies / joints

/**
 * Ir joint, including operation kind, name, joint type, side a, and side b.
 */
export type IRJoint = {
  kind: 'joint';
  name: string;
  jointType: 'fixed' | 'revolute' | 'slider' | 'planar' | 'ball';
  sideA: string; // symbolic face label e.g. "lid.hinge_axis"
  sideB: string; // e.g. "housing.hinge_axis"
  limitMin?: number; // deg for revolute/ball, mm for slider/planar
  limitMax?: number;
  defaultValue?: number;
  span: SourceSpan;
};

/**
 * Resolved joint data, including name, joint type, limit min, limit max, and default value.
 */
export type ResolvedJointData = {
  name: string;
  jointType: IRJoint['jointType'];
  limitMin?: number;
  limitMax?: number;
  defaultValue: number;
  origin: [number, number, number]; // pivot point in world coords
  axis: [number, number, number]; // unit direction for rotation/translation
  movingPartName: string; // sideA object prefix
  staticPartName: string; // sideB object prefix
};

// Sheet metal (M33)

// A flange grown from a straight base-panel edge. The cross-section profile
// (bend arc + flat flange) is precomputed by the evaluator in the (u, v) plane
// and prismed along the edge by the OCCT bridge, then fused into objName.
/**
 * Ir flange, including operation kind, obj name, edge name, profile, and origin.
 */
export type IRFlange = {
  kind: 'flange';
  objName: string; // base panel body to fuse the flange into
  edgeName: string; // named edge, for diagnostics
  profile: IRProfileSegment[]; // cross-section in local (u, v) coords
  origin: [number, number, number]; // edge start point (world)
  edgeDir: [number, number, number]; // unit direction along the edge (prism dir)
  outwardDir: [number, number, number]; // unit u-axis: base-outward, ⊥ edge
  edgeLength: number;
  span: SourceSpan;
};

/**
 * Ir flat pattern segment, including x1, y1, x2, y2, and layer.
 */
export type IRFlatPatternSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layer: 'OUTLINE' | 'BEND';
};

// A flat-pattern DXF export. Outline + bend lines are precomputed analytically
// by the evaluator; the OCCT bridge only formats and emits the DXF file.
/**
 * Ir flat pattern, including operation kind, name, export format, path, and segments.
 */
export type IRFlatPattern = {
  kind: 'flat_pattern';
  name: string;
  format: 'dxf';
  path: string;
  segments: IRFlatPatternSegment[];
  span: SourceSpan;
};
