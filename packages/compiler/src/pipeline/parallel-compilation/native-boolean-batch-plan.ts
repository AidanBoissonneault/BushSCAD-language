/**
 * @author Aidan Boissonneault
 * @file native-boolean-batch-plan.ts
 * @purpose Provides native boolean batch plan behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  IROp,
  IRProgram,
  NativeBooleanBatch,
  NativeBooleanBatchPlan,
  NativeBooleanBatchRejection,
} from '@bushscad/ir';
import { partitionProgram, type PartGroup } from './graph-lowering-support.js';
import {
  nativeBooleanMaterialKey as materialKey,
  nativeBooleanProducerIndices as producerIndices,
  nativeBooleanRootName as rootName,
} from './native-boolean-dependencies.js';
import { planExplicitNativeFuse } from './native-fuse-batch-plan.js';
import {
  finishNativeBooleanRun,
  nativeBooleanIncompatibility,
  type NativeBooleanCandidate,
  type NativeBooleanRun,
} from './native-boolean-run-proof.js';

/**
 * State for group plan, including part name, producers, batches, rejections, and active.
 */
type GroupPlanState = {
  partName: string;
  producers: ReadonlyMap<string, readonly number[]>;
  batches: NativeBooleanBatch[];
  rejections: NativeBooleanBatchRejection[];
  active?: NativeBooleanRun;
};

/**
 * Proves source-ordered like-operation runs against one immutable target.
 * Native multi-shape booleans may skip intermediate BReps only when every
 * member's evaluated profile, placement, extent, and target predate the run.
 */
export function planNativeBooleanBatches(
  program: IRProgram,
): NativeBooleanBatchPlan {
  const batches: NativeBooleanBatch[] = [];
  const rejections: NativeBooleanBatchRejection[] = [];
  for (const group of partitionProgram(program.ops)) {
    planGroup(group, batches, rejections);
  }
  return { version: 1, batches, rejections };
}
/**
 * Handles plan group in the pipeline parallel compilation flow.
 */
function planGroup(
  group: PartGroup,
  batches: NativeBooleanBatch[],
  rejections: NativeBooleanBatchRejection[],
): void {
  const state: GroupPlanState = {
    partName: group.name,
    producers: producerIndices(group),
    batches,
    rejections,
  };
  for (const [opIndex, { op }] of group.ops.entries()) {
    planGroupOperation(state, op, opIndex);
  }
  finishActiveRun(state);
}

/**
 * Handles plan group operation in the pipeline parallel compilation flow.
 */
function planGroupOperation(
  state: GroupPlanState,
  op: Exclude<IROp, { kind: 'part' }>,
  opIndex: number,
): void {
  if (op.kind === 'sketch') {
    state.active?.interveningSketches.push(op);
    return;
  }
  if (op.kind === 'fuse') {
    planFuseOperation(state, op, opIndex);
    return;
  }
  planCandidateOperation(state, op, opIndex);
}

/**
 * Handles plan fuse operation in the pipeline parallel compilation flow.
 */
function planFuseOperation(
  state: GroupPlanState,
  op: Extract<IROp, { kind: 'fuse' }>,
  opIndex: number,
): void {
  const consumed = finishActiveRun(
    state,
    "intervening 'fuse' observes or changes ordered state",
    op,
  );
  if (consumed) return;
  const planned = planExplicitNativeFuse(
    state.partName,
    op,
    opIndex,
    state.producers,
  );
  if (planned.batch) state.batches.push(planned.batch);
  if (planned.rejection) state.rejections.push(planned.rejection);
}

/**
 * Handles plan candidate operation in the pipeline parallel compilation flow.
 */
function planCandidateOperation(
  state: GroupPlanState,
  op: Exclude<IROp, { kind: 'part' | 'sketch' | 'fuse' }>,
  opIndex: number,
): void {
  const candidate = batchCandidate(state.partName, op, opIndex);
  if (!candidate) {
    finishActiveRun(
      state,
      `intervening '${op.kind}' observes or changes ordered state`,
      op,
    );
    return;
  }
  if (!state.active) {
    state.active = newRun(candidate);
    return;
  }
  const reason = nativeBooleanIncompatibility(
    state.active,
    candidate,
    state.producers,
  );
  if (reason) {
    finishActiveRun(state, reason);
    state.active = newRun(candidate);
    return;
  }
  state.active.candidates.push(candidate);
  state.active.interveningSketches = [];
}

/**
 * Completes active run and records its final state.
 */
function finishActiveRun(
  state: GroupPlanState,
  barrierReason?: string,
  barrierOp?: Exclude<IROp, { kind: 'part' }>,
): boolean {
  if (!state.active) return false;
  const consumed = finishNativeBooleanRun(
    state.partName,
    state.active,
    state.producers,
    state.batches,
    state.rejections,
    barrierReason,
    barrierOp,
  );
  state.active = undefined;
  return consumed;
}

/**
 * Handles new run in the pipeline parallel compilation flow.
 */
function newRun(candidate: NativeBooleanCandidate): NativeBooleanRun {
  return { candidates: [candidate], interveningSketches: [] };
}

/**
 * Handles batch candidate in the pipeline parallel compilation flow.
 */
function batchCandidate(
  partName: string,
  op: Exclude<IROp, { kind: 'part' }>,
  opIndex: number,
): NativeBooleanCandidate | undefined {
  if (op.kind === 'cut' && !op.wrap) {
    const targetName = rootName(op.from.faceRef);
    if (op.throughTarget && rootName(op.throughTarget) !== targetName) return;
    return {
      kind: 'cut',
      op,
      opIndex,
      name: op.objName,
      profileName: op.sketchName,
      targetName,
      materialKey: '',
    };
  }
  if (
    op.kind === 'extrude' &&
    partName !== '__default__' &&
    op.from &&
    !op.wrap
  ) {
    return {
      kind: 'additive-extrude',
      op,
      opIndex,
      name: op.objName,
      profileName: op.sketchName,
      targetName: rootName(op.from.faceRef),
      materialKey: materialKey(op.material),
    };
  }
  return undefined;
}
