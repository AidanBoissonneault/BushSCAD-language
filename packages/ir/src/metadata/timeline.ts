/**
 * @author Aidan Boissonneault
 * @file timeline.ts
 * @purpose Provides timeline behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  IRProgram,
  SourceSpan,
  ValidationResult,
} from '../shared/ir.js';
import { buildTimelineSteps } from './timeline-steps.js';
import type { TimelineIcon, TimelineStep } from './timeline-types.js';

export type {
  EditableTimelineParam,
  TimelineIcon,
  TimelineStep,
  TimelineStepKind,
} from './timeline-types.js';
export {
  buildTimelineSteps,
  timelineObjectsTouchedBy,
} from './timeline-steps.js';
export { TIMELINE_FA_ICON, timelineSpanKey } from './timeline-types.js';

/** Groups IR operations into collapsed timeline steps with diagnostics. */
export function groupOpsToTimelineSteps(
  ir: IRProgram,
  errors: CompileError[],
  validations: ValidationResult[] = [],
): TimelineStep[] {
  const steps = collapseLoopSteps(buildTimelineSteps(ir));
  for (const step of steps) {
    step.errors = errors.filter((error) => sameLine(error.span, step.span));
    step.validations = validations.filter(
      (result) => !result.passed && sameLine(result.span, step.span),
    );
  }
  return steps;
}

/**
 * Handles collapse loop steps in the metadata flow.
 */
function collapseLoopSteps(steps: TimelineStep[]): TimelineStep[] {
  const collapsed: TimelineStep[] = [];
  for (const step of steps) {
    const previous = collapsed.at(-1);
    if (
      previous?.kind === 'feature' &&
      step.kind === 'feature' &&
      previous.spanKey === step.spanKey
    ) {
      previous.loopCount += 1;
      previous.opIndices.push(...step.opIndices);
      previous.lastOpIndex = step.lastOpIndex;
      for (const object of step.objs)
        if (!previous.objs.includes(object)) previous.objs.push(object);
    } else collapsed.push(step);
  }
  for (const step of collapsed)
    if (step.loopCount > 1) step.label = `${step.label} ×${step.loopCount}`;
  return collapsed;
}

/**
 * Checks whether the supplied line values are equivalent.
 */
function sameLine(left: SourceSpan, right: SourceSpan): boolean {
  return left.file === right.file && left.line === right.line;
}

const OPERATION_NAMES: Record<TimelineIcon, string> = {
  extrude: 'Extrude',
  cut: 'Cut',
  revolve: 'Revolve',
  radial_extrude: 'Radial extrude',
  radial_cut: 'Radial cut',
  loft: 'Loft',
  fillet: 'Fillet',
  chamfer: 'Chamfer',
  shell: 'Shell',
  draft: 'Draft',
  rotate: 'Rotate',
  part: 'Part',
};

/** Returns a stable operation title independent of generated identifiers. */
export function timelineOperationName(icon: TimelineIcon): string {
  return OPERATION_NAMES[icon];
}

/** Formats a generated timeline identifier for compact presentation. */
export function readableTimelineName(value: string): string {
  return value
    .replace(/\s*(?:\u00d7|x)\d+\s*$/i, '')
    .replace(/_\d+$/, '')
    .replace(/_/g, ' ')
    .trim();
}

/** Selects the affected object name used below a timeline operation title. */
export function timelineTargetName(step: TimelineStep): string {
  if (step.kind === 'part-boundary') return step.partName || step.label;
  const objectName = step.objs.at(-1);
  if (objectName) return objectName;
  const operation = timelineOperationName(step.icon);
  const label = step.label.startsWith(`${operation} `)
    ? step.label.slice(operation.length).trim()
    : step.label;
  return label || step.partName || 'Model';
}

/** Maps persisted latest state onto the explicit visual endpoint. */
export function timelineDisplayPosition(
  cursorIndex: number,
  stepCount: number,
): number {
  return cursorIndex < 0 ? stepCount : Math.min(cursorIndex, stepCount);
}

/** Maps the explicit visual endpoint back to persisted latest state. */
export function timelineStoredCursor(
  position: number,
  stepCount: number,
): number {
  return position >= stepCount ? -1 : Math.max(0, position);
}

/** Finds the nearest step-or-latest center for pointer scrubbing. */
export function nearestTimelinePosition(
  pointerX: number,
  centers: readonly number[],
): number {
  let nearest = 0;
  let distance = Number.POSITIVE_INFINITY;
  centers.forEach((center, position) => {
    const candidate = Math.abs(center - pointerX);
    if (candidate < distance) {
      distance = candidate;
      nearest = position;
    }
  });
  return nearest;
}

/** Explains why a detail step cannot cross another model dependency. */
export function timelineReorderBlockReason(
  steps: TimelineStep[],
  fromIndex: number,
  toIndex: number,
): string | null {
  if (fromIndex === toIndex) return null;
  const moving = steps[fromIndex];
  if (!moving || moving.kind !== 'detail')
    return 'Only detail steps can be reordered';
  for (
    let index = Math.min(fromIndex, toIndex);
    index <= Math.max(fromIndex, toIndex);
    index += 1
  ) {
    if (index === fromIndex) continue;
    const other = steps[index];
    if (other.kind === 'part-boundary')
      return `Can't move ${moving.label} across part boundary`;
    const conflict = other.objs.find((object) => moving.objs.includes(object));
    if (conflict)
      return `Can't move: ${moving.label} and ${other.label} both modify ${conflict}`;
  }
  return null;
}

/** Returns full source lines belonging only to steps after a rollback point. */
export function excludedTimelineSourceSpans(
  program: IRProgram | null,
  steps: readonly TimelineStep[],
  cursorIndex: number,
  file: string,
): SourceSpan[] {
  if (!program || cursorIndex < 0 || cursorIndex >= steps.length - 1) return [];
  const activeFile = normalizePath(file);
  const spans = new Map<string, SourceSpan>();
  for (const step of steps.slice(cursorIndex + 1)) {
    addWholeLineSpan(spans, step.span, activeFile);
    for (const opIndex of step.opIndices) {
      const op = program.ops[opIndex];
      if (op) addWholeLineSpan(spans, op.span, activeFile);
    }
  }
  return [...spans.values()].sort(
    (left, right) => left.line - right.line || left.col - right.col,
  );
}

/**
 * Adds whole line span to its owning collection.
 */
function addWholeLineSpan(
  spans: Map<string, SourceSpan>,
  source: SourceSpan,
  activeFile: string,
): void {
  if (normalizePath(source.file) !== activeFile) return;
  const span = {
    file: source.file,
    line: source.line,
    col: 1,
    endLine: source.endLine ?? source.line,
  };
  spans.set(`${span.line}:${span.endLine}`, span);
}

/**
 * Normalizes path into the canonical form.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}
