/**
 * @author Aidan Boissonneault
 * @file native-boolean-policy.test.ts
 * @purpose Tests native boolean policy behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import type { OcctTraceEvent } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { nativeStats } from '../../src/service/parallel/native-boolean-policy.js';

describe('native boolean execution metrics', () => {
  it('counts executed batches and avoided builds', () => {
    const events = [
      { kind: 'native-boolean-batch', batchSize: 6 },
      { kind: 'native-boolean-batch-rejected' },
    ] as OcctTraceEvent[];
    expect(nativeStats(events)).toEqual({
      batchCount: 1,
      avoidedBuildCount: 5,
      rejectionCount: 1,
    });
  });

  it('does not claim a planned batch when runtime execution was rejected', () => {
    const events = [
      { kind: 'native-boolean-batch-rejected', batchSize: 4 },
    ] as OcctTraceEvent[];
    expect(nativeStats(events)).toEqual({
      batchCount: 0,
      avoidedBuildCount: 0,
      rejectionCount: 1,
    });
  });
});
