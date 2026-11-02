/**
 * @author Aidan Boissonneault
 * @file build-trace.ts
 * @purpose Builds trace for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IROp,
  OcctTraceEvent,
  ResolvedSelection,
  ResolvedSelectionTarget,
  SourceSpan,
} from '@bushscad/ir';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';

/**
 * Occt build trace, including events and on event.
 */
export type OcctBuildTrace = {
  events: OcctTraceEvent[];
  onEvent?: (event: OcctTraceEvent) => void;
};

/**
 * Type used for snapshot of body.
 */
type BodySnapshot = Map<string, OC>;

/**
 * Handles now ms in the operations flow.
 */
function nowMs(): number {
  return Date.now();
}

/**
 * Handles sorted names in the operations flow.
 */
function sortedNames(names: Iterable<string>): string[] {
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Handles op name in the operations flow.
 */
function opName(op: IROp): string | undefined {
  const candidate = op as {
    name?: string;
    objName?: string;
    target?: string;
    sketchName?: string;
    fitName?: string;
  };
  return (
    candidate.objName ??
    candidate.name ??
    candidate.target ??
    candidate.sketchName ??
    candidate.fitName
  );
}

/**
 * Creates a no-policy trace event sink for a single OCCT build.
 * The bridge needs to collect source-mapped build diagnostics only when the UI
 * explicitly asks for them, without coupling OCCT build logic to renderer state.
 */
export function createOcctBuildTrace(
  onEvent?: (event: OcctTraceEvent) => void,
): OcctBuildTrace {
  return { events: [], onEvent };
}

/**
 * Captures the body-name to shape-object mapping used for operation diffs.
 * Shape identity changes are the cheapest reliable signal that an IR operation
 * modified a named body inside the current bridge state.
 */
export function snapshotBodies(state: GroupBuildState): BodySnapshot {
  return new Map(state.bodyShapes);
}

/**
 * Emits a trace event while keeping timestamps consistent.
 */
export function pushTraceEvent(
  trace: OcctBuildTrace | undefined,
  event: Omit<OcctTraceEvent, 'timestampMs'>,
): void {
  if (!trace) return;
  const nextEvent = { timestampMs: nowMs(), ...event };
  trace.events.push(nextEvent);
  try {
    trace.onEvent?.(nextEvent);
  } catch {
    // Trace streaming must never affect geometry build behavior.
  }
}

/**
 * Emits the start of an IR operation with the body names currently known.
 */
export function pushOpStart(
  trace: OcctBuildTrace | undefined,
  partName: string,
  op: IROp,
  before: BodySnapshot,
): void {
  for (const selection of opSelections(op)) {
    pushTraceEvent(trace, {
      kind: 'selector-resolution',
      partName,
      opKind: op.kind,
      opName: opName(op),
      span: selection.span,
      requestedSelectorKind: selection.requestedKind,
      resolvedTopologyKind: selection.resolvedKind,
      selectorLabel: selection.label,
      matchCount: selection.matchCount,
      selectorPhase: 'expanded',
    });
  }
  pushTraceEvent(trace, {
    kind: 'op-start',
    partName,
    opKind: op.kind,
    opName: opName(op),
    span: op.span,
    bodiesBefore: sortedNames(before.keys()),
  });
}

/**
 * Selection trace, including span, requested kind, resolved kind, display label, and match
 * count.
 */
type SelectionTrace = {
  span: SourceSpan;
  requestedKind: string;
  resolvedKind: string;
  label: string;
  matchCount: number;
};

/**
 * Handles op selections in the operations flow.
 */
function opSelections(op: IROp): SelectionTrace[] {
  const candidate = op as unknown as Record<string, unknown>;
  const values = [
    candidate.selection,
    placementSelection(candidate.from),
    placementSelection(candidate.placement),
    placementSelection(candidate.axis),
  ];
  return values.flatMap(selectionTrace);
}

/**
 * Handles placement selection in the operations flow.
 */
function placementSelection(value: unknown): unknown {
  return isRecord(value) ? value.selection : undefined;
}

/**
 * Handles selection trace in the operations flow.
 */
function selectionTrace(value: unknown): SelectionTrace[] {
  if (!isRecord(value)) return [];
  if (Array.isArray(value.targets)) {
    const selection = value as unknown as ResolvedSelection;
    const resolvedKinds = [
      ...new Set(selection.targets.map((target) => target.topologyKind)),
    ];
    return [
      {
        span: selection.sourceSpan,
        requestedKind: selection.requestedKind,
        resolvedKind:
          resolvedKinds.length === 1
            ? (resolvedKinds[0] ?? 'unknown')
            : 'mixed',
        label: selection.targets.map((target) => target.label).join(', '),
        matchCount: selection.targets.length,
      },
    ];
  }
  if ('selectorKind' in value && 'topologyKind' in value) {
    const target = value as unknown as ResolvedSelectionTarget;
    return [
      {
        span: target.source.selectorSpan,
        requestedKind: target.selectorKind,
        resolvedKind: target.topologyKind,
        label: target.label,
        matchCount: 1,
      },
    ];
  }
  return [];
}

/**
 * Returns whether the input meets the `record` condition.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Emits a successful IR operation and includes added, removed, and replaced
 * body names based on before/after shape identity.
 */
export function pushOpSuccess(
  trace: OcctBuildTrace | undefined,
  partName: string,
  op: IROp,
  before: BodySnapshot,
  after: BodySnapshot,
  elapsedMs: number,
): void {
  const addedBodies: string[] = [];
  const removedBodies: string[] = [];
  const modifiedBodies: string[] = [];

  for (const [name, shape] of after) {
    if (!before.has(name)) {
      addedBodies.push(name);
      continue;
    }
    if (before.get(name) !== shape) modifiedBodies.push(name);
  }
  for (const name of before.keys()) {
    if (!after.has(name)) removedBodies.push(name);
  }

  pushTraceEvent(trace, {
    kind: 'op-success',
    partName,
    opKind: op.kind,
    opName: opName(op),
    span: op.span,
    elapsedMs,
    bodiesBefore: sortedNames(before.keys()),
    bodiesAfter: sortedNames(after.keys()),
    addedBodies: sortedNames(addedBodies),
    removedBodies: sortedNames(removedBodies),
    modifiedBodies: sortedNames(modifiedBodies),
  });
}

/**
 * Emits a failed IR operation with the best available source span and message.
 */
export function pushOpError(
  trace: OcctBuildTrace | undefined,
  partName: string,
  op: IROp,
  before: BodySnapshot,
  message: string,
  span: SourceSpan,
  elapsedMs: number,
): void {
  pushTraceEvent(trace, {
    kind: 'op-error',
    partName,
    opKind: op.kind,
    opName: opName(op),
    span,
    elapsedMs,
    bodiesBefore: sortedNames(before.keys()),
    message,
  });
}
