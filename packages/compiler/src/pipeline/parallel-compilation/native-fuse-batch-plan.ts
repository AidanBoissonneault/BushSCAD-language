/**
 * @author Aidan Boissonneault
 * @file native-fuse-batch-plan.ts
 * @purpose Provides native fuse batch plan behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  IRFuse,
  IROp,
  NativeBooleanBatch,
  NativeBooleanBatchKind,
  NativeBooleanBatchRejection,
} from '@bushscad/ir';
import {
  nativeBooleanHasProducerBefore,
  nativeBooleanRootName,
} from './native-boolean-dependencies.js';

/**
 * Type used for explicit fuse plan.
 */
export type ExplicitFusePlan = Readonly<{
  batch?: NativeBooleanBatch;
  rejection?: NativeBooleanBatchRejection;
}>;

/**
 * Proves that an explicit fuse can consume fixed, already-placed bodies.
 * Explicit fuses are associative reductions once every named operand has
 * reached its authored pre-fuse revision. Explicit parts retain their positive
 * components until this reduction boundary, including completed world-space
 * transforms, so the native owner can combine the same component set as the
 * classic deferred part-solid flush.
 */
export function planExplicitNativeFuse(
  partName: string,
  op: IRFuse,
  opIndex: number,
  producers: ReadonlyMap<string, readonly number[]>,
): ExplicitFusePlan {
  const targets = [...new Set(op.targets.map(nativeBooleanRootName))];
  const reason = explicitFuseFailure(targets, opIndex, producers);
  if (reason) {
    return {
      rejection: {
        partName,
        opIndex,
        opKind: 'fuse',
        opName: `fuse(${targets.join(', ')})`,
        reason,
      },
    };
  }
  const targetName = targets[0];
  if (!targetName) return {};
  return {
    batch: {
      id: `native-fuse:${partName}:${opIndex}`,
      partName,
      kind: 'fuse',
      targetName,
      memberOpIndices: [opIndex],
      memberNames: targets,
    },
  };
}

/** Requires additive batching to preserve an authored explicit fuse result. */
export function nativeAdditiveFuseFailure(
  kind: NativeBooleanBatchKind,
  targetName: string,
  memberNames: readonly string[],
  barrierOp?: Exclude<IROp, { kind: 'part' }>,
): string | undefined {
  if (kind !== 'additive-extrude') return;
  if (barrierOp?.kind !== 'fuse') {
    return 'additive members are not followed by an equivalent explicit fuse';
  }
  const fusedTargets = new Set(barrierOp.targets.map(nativeBooleanRootName));
  if ([targetName, ...memberNames].some((name) => !fusedTargets.has(name))) {
    return 'following fuse does not include the target and every additive member';
  }
  return undefined;
}

/**
 * Handles explicit fuse failure in the pipeline parallel compilation flow.
 */
function explicitFuseFailure(
  targets: readonly string[],
  opIndex: number,
  producers: ReadonlyMap<string, readonly number[]>,
): string | undefined {
  if (targets.length < 2) return 'fewer than two distinct fuse operands';
  const missing = targets.find(
    (target) => !nativeBooleanHasProducerBefore(producers, target, opIndex),
  );
  return missing
    ? `fuse operand '${missing}' does not exist before the reduction`
    : undefined;
}
