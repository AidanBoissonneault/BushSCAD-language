/**
 * @author Aidan Boissonneault
 * @file timeline-types.ts
 * @purpose Provides timeline types behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  SourceSpan,
  ValidationResult,
} from '../shared/ir.js';

/**
 * Accepted values for timeline step kind are 'feature', 'detail', and 'part-boundary'.
 */
export type TimelineStepKind = 'feature' | 'detail' | 'part-boundary';

/**
 * Accepted values for timeline icon are 'extrude', 'cut', 'revolve', 'radial_extrude',
 * 'radial_cut', 'loft', 'fillet', 'chamfer', 'shell', 'draft', 'rotate', and 'part'.
 */
export type TimelineIcon =
  | 'extrude'
  | 'cut'
  | 'revolve'
  | 'radial_extrude'
  | 'radial_cut'
  | 'loft'
  | 'fillet'
  | 'chamfer'
  | 'shell'
  | 'draft'
  | 'rotate'
  | 'part';

export const TIMELINE_FA_ICON: Record<TimelineIcon, string> = {
  extrude: 'cube',
  cut: 'scissors',
  revolve: 'rotate',
  radial_extrude: 'circle-notch',
  radial_cut: 'circle-half-stroke',
  loft: 'layer-group',
  fillet: 'bezier-curve',
  chamfer: 'vector-square',
  shell: 'box-open',
  draft: 'angles-up',
  rotate: 'rotate-right',
  part: 'shapes',
};

/**
 * Editable timeline param, including name, literal, and span.
 */
export type EditableTimelineParam = {
  name: string;
  literal: string;
  span: SourceSpan;
};

/**
 * Timeline step, including identifier, operation kind, display label, icon, and fa icon.
 */
export type TimelineStep = {
  id: string;
  kind: TimelineStepKind;
  label: string;
  icon: TimelineIcon;
  faIcon: string;
  opIndices: number[];
  lastOpIndex: number;
  span: SourceSpan;
  spanKey: string;
  errors: CompileError[];
  validations: ValidationResult[];
  partName: string | null;
  loopCount: number;
  editableParams: EditableTimelineParam[];
  objs: string[];
};

/**
 * Handles timeline span key in the metadata flow.
 */
export function timelineSpanKey(span: SourceSpan): string {
  return `${span.file}:${span.line}`;
}
