/**
 * @author Aidan Boissonneault
 * @file native-boolean-batch.ts
 * @purpose Describes plans for combining supported Boolean operations in one native batch.
 * @last-edited October 6, 2026
 */

/**
 * Accepted values for native boolean batch kind are 'cut', 'additive-extrude', and 'fuse'.
 */

export type NativeBooleanBatchKind = 'cut' | 'additive-extrude' | 'fuse';

/**
 * Type used for native boolean batch.
 */
export type NativeBooleanBatch = Readonly<{
  id: string;
  partName: string;
  kind: NativeBooleanBatchKind;
  targetName: string;
  memberOpIndices: readonly number[];
  memberNames: readonly string[];
}>;

/**
 * Type used for native boolean batch rejection.
 */
export type NativeBooleanBatchRejection = Readonly<{
  partName: string;
  opIndex: number;
  opKind: 'cut' | 'extrude' | 'fuse';
  opName: string;
  reason: string;
}>;

/** Serializable compiler proof consumed by one OCCT owner worker. */
export type NativeBooleanBatchPlan = Readonly<{
  version: 1;
  batches: readonly NativeBooleanBatch[];
  rejections: readonly NativeBooleanBatchRejection[];
}>;
