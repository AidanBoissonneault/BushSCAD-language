/**
 * @author Aidan Boissonneault
 * @file sketch-preview-metadata.ts
 * @purpose Provides sketch preview metadata behavior for the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import type {
  IRConstraintState,
  SketchPreviewDetail,
  SketchPreviewModel,
} from '@bushscad/ir';

/**
 * Visual severity shown for a sketch-preview status: healthy, warning, danger, or neutral.
 */
export type SketchPreviewStatusTone =
  | 'healthy'
  | 'warning'
  | 'danger'
  | 'neutral';
/**
 * Status shown above a sketch preview, with a primary label, optional detail, and visual
 * severity.
 */
export type SketchPreviewStatus = {
  label: string;
  detail: string;
  tone: SketchPreviewStatusTone;
};
/**
 * One label/value pair displayed in the sketch-preview statistics.
 */
export type SketchPreviewStat = { label: string; value: string };

/** Keeps surrounding metadata focused on dimensions and model health. */
export function importantSketchPreviewDetails(
  details: SketchPreviewDetail[],
): SketchPreviewDetail[] {
  return details
    .filter((detail) => detail.kind === 'dimension' || detail.kind === 'status')
    .slice(0, 6);
}

/** Formats measurements without unnecessary trailing decimal zeroes. */
export function compactSketchPreviewMeasure(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/** Returns concise HUD details, adding bounds when metadata is unavailable. */
export function sketchPreviewDetails(
  preview: SketchPreviewModel,
): SketchPreviewDetail[] {
  const details = importantSketchPreviewDetails(preview.details);
  if (details.length > 0) return details;
  return [
    {
      kind: 'dimension',
      label: 'Bounds',
      value: `${compactSketchPreviewMeasure(preview.bounds.width)} x ${compactSketchPreviewMeasure(preview.bounds.height)} mm`,
    },
  ];
}

/** Summarizes constraint health for a compact viewer status badge. */
export function sketchPreviewConstraintStatus(
  preview: SketchPreviewModel,
): SketchPreviewStatus {
  const state = sketchPreviewConstraintState(preview);
  if (!state)
    return {
      label: preview.isClosed ? 'Closed profile' : 'Read only',
      detail: 'Evaluated geometry',
      tone: 'neutral',
    };
  if (state.status === 'fully-constrained')
    return { label: 'Fully constrained', detail: '0 DOF', tone: 'healthy' };
  if (state.status === 'underconstrained')
    return {
      label: 'Under constrained',
      detail: `${state.dof ?? '?'} DOF free`,
      tone: 'warning',
    };
  return {
    label: 'Constraint conflict',
    detail: state.residual
      ? `Residual ${compactSketchPreviewMeasure(state.residual)}`
      : 'No convergence',
    tone: 'danger',
  };
}

/** Resolves constraint health from either preview or underlying profile IR. */
export function sketchPreviewConstraintState(
  preview: SketchPreviewModel,
): IRConstraintState | undefined {
  const primitive = unplacedPrimitive(preview.primitive);
  return (
    preview.constraintState ??
    (primitive.kind === 'profile' ? primitive.constraintState : undefined)
  );
}

/** Returns the geometric counts most useful while inspecting a sketch. */
export function sketchPreviewStats(
  preview: SketchPreviewModel,
): SketchPreviewStat[] {
  const primitive = unplacedPrimitive(preview.primitive);
  const segments = primitive.kind === 'profile' ? primitive.segments.length : 1;
  const constraints =
    primitive.kind === 'profile' ? (primitive.constraints?.length ?? 0) : 0;
  const dimensions =
    'dimensions' in primitive ? (primitive.dimensions?.length ?? 0) : 0;
  return [
    { label: 'Entities', value: String(segments) },
    { label: 'Relations', value: String(constraints) },
    { label: 'Dimensions', value: String(dimensions) },
    {
      label: 'Size',
      value: `${compactSketchPreviewMeasure(preview.bounds.width)} × ${compactSketchPreviewMeasure(preview.bounds.height)} mm`,
    },
  ];
}

/**
 * Handles unplaced primitive in the sketch preview flow.
 */
function unplacedPrimitive(
  primitive: SketchPreviewModel['primitive'],
): SketchPreviewModel['primitive'] {
  return primitive.kind === 'sketchAt'
    ? unplacedPrimitive(primitive.primitive)
    : primitive;
}
