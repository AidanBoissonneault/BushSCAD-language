/**
 * @author Aidan Boissonneault
 * @file radial.ts
 * @purpose Provides radial behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRFaceLabel,
  IRParamSpans,
  IRPlacement,
  MaterialAppearance,
  SourceSpan,
} from '../shared/ir.js';

/**
 * Ir revolve axis accepts 'x', 'y', 'z', and IRPlacement.
 */
type IRRevolveAxis = 'x' | 'y' | 'z' | IRPlacement;

/**
 * Ir radial curve accepts { kind: | 'natural' | 'linear' | 'ease' | 'ease-in and { kind:
 * 'cubic-bezier'; x1: number; y1: number; x2.
 */
export type IRRadialCurve =
  | {
      kind:
        | 'natural'
        | 'linear'
        | 'ease'
        | 'ease-in'
        | 'ease-out'
        | 'ease-in-out'
        | 'step-start'
        | 'step-end';
    }
  | { kind: 'cubic-bezier'; x1: number; y1: number; x2: number; y2: number };

/**
 * Ir radial extent is tagged by kind: 'angle-length' carries angle deg, length mm, 'between'
 * carries a, b, and 'placement-bridge' carries from, to, guide path name.
 */
export type IRRadialExtent =
  | { kind: 'angle-length'; angleDeg: number; lengthMm: number }
  | { kind: 'between'; a: IRFaceLabel; b: IRFaceLabel }
  | {
      kind: 'placement-bridge';
      from: IRPlacement;
      to: IRPlacement;
      guidePathName: string | null;
    };

/**
 * Accepted values for ir radial direction are 'ccw' and 'cw'.
 */
export type IRRadialDirection = 'ccw' | 'cw';

/**
 * Ir radial extrude, including operation kind, obj name, sketch name, axis, and extent.
 */
export type IRRadialExtrude = {
  kind: 'radial_extrude';
  objName: string;
  sketchName: string;
  axis: IRRevolveAxis;
  extent: IRRadialExtent;
  curve: IRRadialCurve;
  direction: IRRadialDirection;
  startDeg: number;
  twistDeg: number;
  taperDeg: number;
  radius: number;
  sections: number | null;
  from: IRPlacement | null;
  material?: MaterialAppearance | null;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir radial cut, including operation kind, obj name, sketch name, axis, and extent.
 */
export type IRRadialCut = {
  kind: 'radial_cut';
  objName: string;
  sketchName: string;
  axis: IRRevolveAxis;
  extent: IRRadialExtent;
  curve: IRRadialCurve;
  direction: IRRadialDirection;
  startDeg: number;
  twistDeg: number;
  taperDeg: number;
  radius: number;
  sections: number | null;
  from: IRPlacement;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};
