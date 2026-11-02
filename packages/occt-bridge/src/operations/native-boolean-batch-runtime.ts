/**
 * @author Aidan Boissonneault
 * @file native-boolean-batch-runtime.ts
 * @purpose Provides native boolean batch runtime behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  IRCut,
  IRExtrude,
  IRFuse,
  IROp,
  NativeBooleanBatch,
  NativeBooleanBatchPlan,
} from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { pushTraceEvent, type OcctBuildTrace } from './build-trace.js';
import { applyNativeParallelBoolean } from './native-parallel-booleans.js';

/**
 * Type used for prepared native cut.
 */
export type PreparedNativeCut = Readonly<{
  op: IRCut;
  targetName: string;
  targetShape: OC;
  tool: OC;
  axis: OC;
}>;

/**
 * Type used for prepared native fuse.
 */
export type PreparedNativeFuse = Readonly<{
  op: IRFuse;
  target: OC;
  tools: readonly OC[];
  commit: (result: OC) => void;
}>;

/**
 * Type used for native batch runtime callbacks.
 */
export type NativeBatchRuntimeCallbacks = Readonly<{
  applyDefault: (op: Exclude<IROp, { kind: 'part' }>) => void;
  prepareCut: (op: IRCut) => PreparedNativeCut;
  commitCuts: (prepared: readonly PreparedNativeCut[], result: OC) => void;
  additiveTarget: (targetName: string) => OC | undefined;
  additiveTool: (name: string) => OC | undefined;
  commitFuse: (result: OC) => void;
  prepareFuse: (op: IRFuse) => PreparedNativeFuse | undefined;
  canBatchCut: (targetName: string) => boolean;
  canBatchAdditiveFuse: (targetName: string) => boolean;
  canBatchExplicitFuse: () => boolean;
}>;

/**
 * Active batch, including batch, cuts, target, and tools.
 */
type ActiveBatch = {
  batch: NativeBooleanBatch;
  cuts: PreparedNativeCut[];
  target?: OC;
  tools: OC[];
};

/** Executes proven plan members while replaying their semantic state in order. */
export class NativeBooleanBatchRuntime {
  private readonly memberToBatch = new Map<number, NativeBooleanBatch>();
  private readonly active = new Map<string, ActiveBatch>();
  private readonly rejected = new Set<string>();

  /**
   * Initializes the `NativeBooleanBatchRuntime` instance with the values supplied by its caller.
   */
  constructor(
    private readonly oc: OC,
    private readonly partName: string,
    plan: NativeBooleanBatchPlan,
    private readonly callbacks: NativeBatchRuntimeCallbacks,
    private readonly trace?: OcctBuildTrace,
    private readonly concurrencyLimit = 1,
  ) {
    for (const rejection of plan.rejections) {
      if (rejection.partName !== partName) continue;
      pushTraceEvent(trace, {
        kind: 'native-boolean-batch-rejected',
        partName,
        opKind: rejection.opKind,
        opName: rejection.opName,
        message: rejection.reason,
      });
    }
    for (const batch of plan.batches) {
      if (batch.partName !== partName) continue;
      for (const index of batch.memberOpIndices) {
        this.memberToBatch.set(index, batch);
      }
    }
  }

  /** Returns true when the operation was handled by its planned native batch. */
  apply(opIndex: number, op: Exclude<IROp, { kind: 'part' }>): boolean {
    const batch = this.memberToBatch.get(opIndex);
    if (!batch || this.rejected.has(batch.id)) return false;
    if (batch.kind === 'fuse') return this.applyExplicitFuse(batch, op);
    return this.applyRunMember(batch, opIndex, op);
  }

  /**
   * Applies run member to the supplied state or geometry.
   */
  private applyRunMember(
    batch: NativeBooleanBatch,
    opIndex: number,
    op: Exclude<IROp, { kind: 'part' }>,
  ): boolean {
    const position = batch.memberOpIndices.indexOf(opIndex);
    if (position < 0) return false;
    if (position === 0 && !this.start(batch)) return false;
    const active = this.active.get(batch.id);
    if (!active) return false;

    const batchOp =
      batch.kind === 'cut'
        ? this.applyCutMember(active, op)
        : this.applyAdditiveMember(active, op);

    if (position === batch.memberOpIndices.length - 1)
      this.finish(active, batchOp);
    return true;
  }

  /**
   * Applies explicit fuse to the supplied state or geometry.
   */
  private applyExplicitFuse(
    batch: NativeBooleanBatch,
    op: Exclude<IROp, { kind: 'part' }>,
  ): boolean {
    if (op.kind !== 'fuse')
      return this.reject(batch, 'planned fuse kind changed');
    if (!this.callbacks.canBatchExplicitFuse()) {
      return this.reject(
        batch,
        'runtime does not expose native fuse ownership',
      );
    }
    const prepared = this.callbacks.prepareFuse(op);
    if (!prepared) {
      return this.reject(
        batch,
        'fuse operands no longer have distinct fixed owners',
      );
    }
    const result = applyNativeParallelBoolean(
      this.oc,
      'fuse',
      prepared.target,
      prepared.tools,
      op.span,
    );
    prepared.commit(result.shape);
    this.traceSuccess(batch, 'fuse', op, prepared.tools.length, result);
    return true;
  }

  /**
   * Applies cut member to the supplied state or geometry.
   */
  private applyCutMember(
    active: ActiveBatch,
    op: Exclude<IROp, { kind: 'part' }>,
  ): IRCut {
    if (op.kind !== 'cut')
      this.failActive(active.batch, 'planned cut kind changed');
    const prepared = this.callbacks.prepareCut(op);
    active.cuts.push(prepared);
    active.tools.push(prepared.tool);
    return op;
  }

  /**
   * Applies additive member to the supplied state or geometry.
   */
  private applyAdditiveMember(
    active: ActiveBatch,
    op: Exclude<IROp, { kind: 'part' }>,
  ): IRExtrude {
    if (op.kind !== 'extrude')
      this.failActive(active.batch, 'planned extrusion kind changed');
    this.callbacks.applyDefault(op);
    const tool = this.callbacks.additiveTool(op.objName);
    if (!tool)
      this.failActive(active.batch, `missing additive tool '${op.objName}'`);
    active.tools.push(tool);
    return op;
  }

  /**
   * Starts with the supplied configuration.
   */
  private start(batch: NativeBooleanBatch): boolean {
    const allowed =
      batch.kind === 'cut'
        ? this.callbacks.canBatchCut(batch.targetName)
        : this.callbacks.canBatchAdditiveFuse(batch.targetName);
    if (!allowed)
      return this.reject(
        batch,
        'runtime target is not one immutable component',
      );
    const target =
      batch.kind === 'additive-extrude'
        ? this.callbacks.additiveTarget(batch.targetName)
        : undefined;
    this.active.set(batch.id, { batch, cuts: [], target, tools: [] });
    return true;
  }

  /**
   * Completes and records its final state.
   */
  private finish(active: ActiveBatch, lastOp: IRCut | IRExtrude): void {
    const target = active.cuts[0]?.targetShape ?? active.target;
    if (!target) {
      this.failActive(active.batch, 'native batch target disappeared');
    }
    const kind = active.batch.kind === 'cut' ? 'cut' : 'fuse';
    const result = applyNativeParallelBoolean(
      this.oc,
      kind,
      target,
      active.tools,
      lastOp.span,
    );
    if (kind === 'cut') {
      this.callbacks.commitCuts(active.cuts, result.shape);
    } else {
      this.callbacks.commitFuse(result.shape);
    }
    this.traceSuccess(active.batch, kind, lastOp, active.tools.length, result);
    this.active.delete(active.batch.id);
  }

  /**
   * Handles trace success in the operations flow.
   */
  private traceSuccess(
    batch: NativeBooleanBatch,
    kind: 'cut' | 'fuse',
    op: IRCut | IRExtrude | IRFuse,
    toolCount: number,
    result: ReturnType<typeof applyNativeParallelBoolean>,
  ): void {
    pushTraceEvent(this.trace, {
      kind: 'native-boolean-batch',
      partName: this.partName,
      opKind: kind,
      opName: batch.memberNames.at(-1),
      span: op.span,
      elapsedMs: result.elapsedMs,
      cpuMs: result.cpuMs,
      batchId: batch.id,
      batchSize: toolCount,
      batchMemberNames: [...batch.memberNames],
      batchTargetName: batch.targetName,
      nativeApi: result.nativeApi,
      runParallel: result.runParallel,
      booleanBuildCount: result.booleanBuildCount,
      nativeConcurrencyLimit: this.concurrencyLimit,
    });
  }

  /**
   * Handles reject in the operations flow.
   */
  private reject(batch: NativeBooleanBatch, reason: string): false {
    this.rejected.add(batch.id);
    this.active.delete(batch.id);
    pushTraceEvent(this.trace, {
      kind: 'native-boolean-batch-rejected',
      partName: this.partName,
      opKind: batch.kind,
      opName: batch.memberNames[0],
      batchId: batch.id,
      batchSize: batch.memberOpIndices.length,
      batchMemberNames: [...batch.memberNames],
      batchTargetName: batch.targetName,
      message: reason,
    });
    return false;
  }

  /**
   * Handles fail active in the operations flow.
   */
  private failActive(batch: NativeBooleanBatch, reason: string): never {
    this.reject(batch, reason);
    throw new Error(`Native boolean batch '${batch.id}' failed: ${reason}`);
  }
}
