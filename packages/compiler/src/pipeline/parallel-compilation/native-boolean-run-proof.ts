/**
 * @author Aidan Boissonneault
 * @file native-boolean-run-proof.ts
 * @purpose Provides native boolean run proof behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  IROp,
  NativeBooleanBatch,
  NativeBooleanBatchKind,
  NativeBooleanBatchRejection,
} from '@bushscad/ir';
import {
  nativeBooleanHasProducerBefore,
  nativeBooleanHasProducerInRange,
  nativeBooleanInputNames,
  nativeBooleanRejection,
} from './native-boolean-dependencies.js';
import { nativeAdditiveFuseFailure } from './native-fuse-batch-plan.js';

/**
 * Type used for native boolean candidate.
 */
export type NativeBooleanCandidate = Readonly<{
  kind: NativeBooleanBatchKind;
  op: Extract<IROp, { kind: 'cut' | 'extrude' }>;
  opIndex: number;
  name: string;
  profileName: string;
  targetName: string;
  materialKey: string;
}>;

/**
 * Native boolean run, including candidates and intervening sketches.
 */
export type NativeBooleanRun = {
  candidates: NativeBooleanCandidate[];
  interveningSketches: Exclude<IROp, { kind: 'part' }>[];
};

/** Completes one run as either a native batch or stable rejection records. */
export function finishNativeBooleanRun(
  partName: string,
  run: NativeBooleanRun,
  producers: ReadonlyMap<string, readonly number[]>,
  batches: NativeBooleanBatch[],
  rejections: NativeBooleanBatchRejection[],
  barrierReason?: string,
  barrierOp?: Exclude<IROp, { kind: 'part' }>,
): boolean {
  const failure = runFailure(run, producers, barrierOp);
  if (run.candidates.length >= 2 && !failure) {
    return acceptRun(partName, run.candidates, batches, barrierOp);
  }
  rejectRun(
    partName,
    run.candidates,
    failure ?? barrierReason ?? 'fewer than two compatible members',
    rejections,
  );
  return false;
}

/** Reports why a new member cannot share the active immutable target run. */
export function nativeBooleanIncompatibility(
  run: NativeBooleanRun,
  next: NativeBooleanCandidate,
  producers: ReadonlyMap<string, readonly number[]>,
): string | undefined {
  const first = run.candidates[0];
  if (!first) return 'empty batch';
  if (first.kind !== next.kind)
    return 'mixed boolean polarity or operation kind';
  if (first.targetName !== next.targetName)
    return 'members use different targets';
  if (first.materialKey !== next.materialKey)
    return 'members use different materials';
  const generated = new Set(run.candidates.map(({ name }) => name));
  if (nativeBooleanInputNames(next.op).some((name) => generated.has(name))) {
    return 'member depends on an earlier generated result';
  }
  const sketchFailure = interveningSketchFailure(run, generated);
  if (sketchFailure) return sketchFailure;
  if (
    !nativeBooleanHasProducerBefore(producers, next.profileName, next.opIndex)
  ) {
    return 'member profile is not resolved before its operation';
  }
  return undefined;
}

/**
 * Handles accept run in the pipeline parallel compilation flow.
 */
function acceptRun(
  partName: string,
  candidates: readonly NativeBooleanCandidate[],
  batches: NativeBooleanBatch[],
  barrierOp?: Exclude<IROp, { kind: 'part' }>,
): boolean {
  const first = candidates[0] as NativeBooleanCandidate;
  batches.push({
    id: `native-${first.kind}:${partName}:${first.opIndex}`,
    partName,
    kind: first.kind,
    targetName: first.targetName,
    memberOpIndices: candidates.map(({ opIndex }) => opIndex),
    memberNames: candidates.map(({ name }) => name),
  });
  return first.kind === 'additive-extrude' && barrierOp?.kind === 'fuse';
}

/**
 * Handles reject run in the pipeline parallel compilation flow.
 */
function rejectRun(
  partName: string,
  candidates: readonly NativeBooleanCandidate[],
  reason: string,
  rejections: NativeBooleanBatchRejection[],
): void {
  for (const candidate of candidates) {
    rejections.push(
      nativeBooleanRejection(
        partName,
        candidate.opIndex,
        candidate.op.kind,
        candidate.name,
        reason,
      ),
    );
  }
}

/**
 * Runs failure and returns its result.
 */
function runFailure(
  run: NativeBooleanRun,
  producers: ReadonlyMap<string, readonly number[]>,
  barrierOp?: Exclude<IROp, { kind: 'part' }>,
): string | undefined {
  const first = run.candidates[0];
  return (
    runDependencyFailure(run.candidates, producers) ??
    interveningSketchFailure(run) ??
    nativeAdditiveFuseFailure(
      first?.kind ?? 'cut',
      first?.targetName ?? '',
      run.candidates.map(({ name }) => name),
      barrierOp,
    )
  );
}

/**
 * Handles intervening sketch failure in the pipeline parallel compilation flow.
 */
function interveningSketchFailure(
  run: NativeBooleanRun,
  generated = new Set(run.candidates.map(({ name }) => name)),
): string | undefined {
  const target = run.candidates[0]?.targetName;
  const observesRun = run.interveningSketches.some((sketch) =>
    nativeBooleanInputNames(sketch).some(
      (name) => name === target || generated.has(name),
    ),
  );
  return observesRun
    ? 'intervening profile observes the batch target or a generated result'
    : undefined;
}

/**
 * Runs dependency failure and returns its result.
 */
function runDependencyFailure(
  candidates: readonly NativeBooleanCandidate[],
  producers: ReadonlyMap<string, readonly number[]>,
): string | undefined {
  const first = candidates[0];
  if (!first) return 'empty batch';
  if (
    !nativeBooleanHasProducerBefore(producers, first.targetName, first.opIndex)
  ) {
    return 'target does not exist before the batch';
  }
  const generated = new Set(candidates.map(({ name }) => name));
  for (const candidate of candidates) {
    const reason = candidateDependencyFailure(
      candidate,
      first,
      generated,
      producers,
    );
    if (reason) return reason;
  }
  return undefined;
}

/**
 * Handles candidate dependency failure in the pipeline parallel compilation flow.
 */
function candidateDependencyFailure(
  candidate: NativeBooleanCandidate,
  first: NativeBooleanCandidate,
  generated: ReadonlySet<string>,
  producers: ReadonlyMap<string, readonly number[]>,
): string | undefined {
  for (const input of nativeBooleanInputNames(candidate.op)) {
    if (
      input === candidate.name ||
      input === candidate.profileName ||
      input === first.targetName
    )
      continue;
    if (generated.has(input)) return 'member reads a generated batch result';
    if (
      nativeBooleanHasProducerInRange(
        producers,
        input,
        first.opIndex,
        candidate.opIndex,
      )
    )
      return `input '${input}' is produced within the batch window`;
  }
  return undefined;
}
