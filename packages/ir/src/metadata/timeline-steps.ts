/**
 * @author Aidan Boissonneault
 * @file timeline-steps.ts
 * @purpose Provides timeline steps behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRProgram, SourceSpan } from '../shared/ir.js';
import {
  TIMELINE_FA_ICON,
  timelineSpanKey,
  type EditableTimelineParam,
  type TimelineIcon,
  type TimelineStep,
  type TimelineStepKind,
} from './timeline-types.js';

/**
 * State for step build, including steps, id counter, pending sketch idx, pending sketch name,
 * and current part name.
 */
type StepBuildState = {
  steps: TimelineStep[];
  idCounter: number;
  pendingSketchIdx: number | null;
  pendingSketchName: string;
  currentPartName: string | null;
};

/** Builds stable UI timeline steps from canonical IR operations. */
export function buildTimelineSteps(ir: IRProgram): TimelineStep[] {
  const state: StepBuildState = {
    steps: [],
    idCounter: 0,
    pendingSketchIdx: null,
    pendingSketchName: '',
    currentPartName: null,
  };
  ir.ops.forEach((op, index) => addTimelineOpStep(state, op, index));
  return state.steps;
}

/**
 * Adds timeline op step to its owning collection.
 */
function addTimelineOpStep(
  state: StepBuildState,
  op: IROp,
  index: number,
): void {
  if (op.kind === 'part') addPartStep(state, op, index);
  else if (op.kind === 'sketch') {
    state.pendingSketchIdx = index;
    state.pendingSketchName = op.name;
  } else if (isFeatureOp(op)) addFeatureStep(state, op, index);
  else if (isDetailOp(op)) addDetailStep(state, op, index);
}

/**
 * Adds part step to its owning collection.
 */
function addPartStep(
  state: StepBuildState,
  op: Extract<IROp, { kind: 'part' }>,
  index: number,
): void {
  state.currentPartName = op.name;
  const step = makeStep(
    state,
    'part-boundary',
    op.name,
    'part',
    [index],
    index,
    op.span,
    [],
    [],
  );
  step.partName = op.name;
  state.steps.push(step);
}

/**
 * Adds feature step to its owning collection.
 */
function addFeatureStep(
  state: StepBuildState,
  op: FeatureOp,
  index: number,
): void {
  const indices =
    state.pendingSketchIdx === null ? [index] : [state.pendingSketchIdx, index];
  state.steps.push(
    makeStep(
      state,
      'feature',
      featureLabel(op, state.pendingSketchName),
      featureIcon(op),
      indices,
      index,
      op.span,
      timelineObjectsTouchedBy(op),
      editableParamsFor(op),
    ),
  );
  state.pendingSketchIdx = null;
  state.pendingSketchName = '';
}

/**
 * Adds detail step to its owning collection.
 */
function addDetailStep(
  state: StepBuildState,
  op: DetailOp,
  index: number,
): void {
  state.steps.push(
    makeStep(
      state,
      'detail',
      detailLabel(op),
      op.kind,
      [index],
      index,
      op.span,
      timelineObjectsTouchedBy(op),
      editableParamsFor(op),
    ),
  );
}

/**
 * Constructs step from the supplied values.
 */
function makeStep(
  state: StepBuildState,
  kind: TimelineStepKind,
  label: string,
  icon: TimelineIcon,
  opIndices: number[],
  lastOpIndex: number,
  span: SourceSpan,
  objs: string[],
  editableParams: EditableTimelineParam[],
): TimelineStep {
  return {
    id: `step-${++state.idCounter}`,
    kind,
    label,
    icon,
    faIcon: TIMELINE_FA_ICON[icon],
    opIndices,
    lastOpIndex,
    span,
    spanKey: timelineSpanKey(span),
    errors: [],
    validations: [],
    partName: state.currentPartName,
    loopCount: 1,
    editableParams,
    objs,
  };
}

/**
 * Selected members of IROp used for feature op.
 */
type FeatureOp = Extract<
  IROp,
  {
    kind:
      | 'extrude'
      | 'cut'
      | 'solid_cut'
      | 'solidPrimitive'
      | 'revolve'
      | 'radial_extrude'
      | 'radial_cut'
      | 'loft';
  }
>;

/**
 * Returns whether the input meets the `feature op` condition.
 */
function isFeatureOp(op: IROp): op is FeatureOp {
  return [
    'extrude',
    'cut',
    'solid_cut',
    'solidPrimitive',
    'revolve',
    'radial_extrude',
    'radial_cut',
    'loft',
  ].includes(op.kind);
}

/**
 * Returns the display label for feature.
 */
function featureLabel(op: FeatureOp, sketchName: string): string {
  switch (op.kind) {
    case 'loft':
      return 'Loft';
    case 'revolve':
      return `Revolve ${sketchName}`;
    case 'radial_extrude':
      return `Radial extrude ${sketchName}`;
    case 'radial_cut':
      return `Radial cut ${sketchName}`;
    case 'cut':
    case 'solid_cut':
      return `Cut ${sketchName}`;
    case 'solidPrimitive':
      return `Primitive ${op.objName}`;
    default:
      return `Extrude ${sketchName}`;
  }
}

/**
 * Handles feature icon in the metadata flow.
 */
function featureIcon(op: FeatureOp): TimelineIcon {
  if (op.kind === 'solid_cut') return 'cut';
  if (op.kind === 'solidPrimitive') return 'extrude';
  return op.kind;
}

/**
 * The fillet variant of IROp, used for detail op.
 */
type DetailOp = Extract<
  IROp,
  { kind: 'fillet' | 'chamfer' | 'shell' | 'draft' | 'rotate' }
>;

/**
 * Returns whether the input meets the `detail op` condition.
 */
function isDetailOp(op: IROp): op is DetailOp {
  return ['fillet', 'chamfer', 'shell', 'draft', 'rotate'].includes(op.kind);
}

/**
 * Returns the display label for detail.
 */
function detailLabel(op: DetailOp): string {
  return operationLabel(op.kind);
}

/**
 * Dispatches the operation to its matching action handler.
 */
function operationLabel(kind: string): string {
  return kind
    .split('_')
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Handles editable params for in the metadata flow.
 */
function editableParamsFor(op: IROp): EditableTimelineParam[] {
  const spans = (
    op as { paramSpans?: Record<string, { span: SourceSpan; literal: string }> }
  ).paramSpans;
  return spans
    ? Object.entries(spans).map(([name, entry]) => ({ name, ...entry }))
    : [];
}

const OBJECT_NAME_OPS = new Set<IROp['kind']>([
  'extrude',
  'cut',
  'solid_cut',
  'solidPrimitive',
  'revolve',
  'radial_extrude',
  'radial_cut',
  'loft',
  'sweep',
  'sweep_cut',
  'shell',
  'patternLinear',
  'patternRadial',
  'mirror',
  'transform',
]);
const TARGET_OPS = new Set<IROp['kind']>([
  'fillet',
  'chamfer',
  'draft',
  'rotate',
  'thread',
]);

/** Lists model objects a timeline operation creates or modifies. */
export function timelineObjectsTouchedBy(op: IROp): string[] {
  if (OBJECT_NAME_OPS.has(op.kind))
    return [(op as Extract<IROp, { objName: string }>).objName];
  if (!TARGET_OPS.has(op.kind)) return [];
  return [(op as Extract<IROp, { target: string }>).target.split('.')[0]];
}
