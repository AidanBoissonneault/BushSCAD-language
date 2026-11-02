/**
 * @author Aidan Boissonneault
 * @file native-boolean-policy.ts
 * @purpose Provides native boolean policy behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { OcctTraceEvent } from '@bushscad/ir';

/**
 * Type used for native boolean stats.
 */
export type NativeBooleanStats = Readonly<{
  batchCount: number;
  avoidedBuildCount: number;
  rejectionCount: number;
}>;

export const EMPTY_NATIVE_STATS: NativeBooleanStats = {
  batchCount: 0,
  avoidedBuildCount: 0,
  rejectionCount: 0,
};

/** Derives metrics from executed worker events, never from planned work. */
export function nativeStats(
  events: readonly OcctTraceEvent[],
): NativeBooleanStats {
  const accepted = events.filter(
    (event) => event.kind === 'native-boolean-batch',
  );
  return {
    batchCount: accepted.length,
    avoidedBuildCount: accepted.reduce(
      (total, event) => total + Math.max(0, (event.batchSize ?? 1) - 1),
      0,
    ),
    rejectionCount: events.filter(
      (event) => event.kind === 'native-boolean-batch-rejected',
    ).length,
  };
}

/** Developer A/B switch; product gating remains the experimental compiler. */
export function nativeBooleanBatchesEnabled(): boolean {
  return process.env.BUSHSCAD_NATIVE_PARALLEL_BREP !== '0';
}
