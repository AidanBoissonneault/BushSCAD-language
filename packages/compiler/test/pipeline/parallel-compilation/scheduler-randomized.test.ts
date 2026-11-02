/**
 * @author Aidan Boissonneault
 * @file scheduler-randomized.test.ts
 * @purpose Tests scheduler randomized behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { simulateCompilationSchedule } from '../../../src/index.js';
import {
  readyWorkerPool,
  schedulerEdge,
  schedulerGraph,
  schedulerNode,
} from '../../fixtures/parallel-compilation/scheduler-graphs.js';

const graph = schedulerGraph(
  [
    schedulerNode('source', 0, { estimatedCost: 'metadata' }),
    schedulerNode('alpha', 1),
    schedulerNode('bravo', 2),
    schedulerNode('charlie', 3),
    schedulerNode('delta', 4),
    schedulerNode('output', 5, { estimatedCost: 'metadata' }),
  ],
  [
    schedulerEdge('source', 'alpha'),
    schedulerEdge('source', 'bravo'),
    schedulerEdge('source', 'charlie'),
    schedulerEdge('source', 'delta'),
    schedulerEdge('alpha', 'output'),
    schedulerEdge('bravo', 'output'),
    schedulerEdge('charlie', 'output'),
    schedulerEdge('delta', 'output'),
  ],
);

describe('parallel scheduler completion-order properties', () => {
  it('keeps statuses, artifacts, and errors stable across randomized finishes', async () => {
    const signatures: string[] = [];
    for (let seed = 1; seed <= 16; seed++) {
      const result = await simulateCompilationSchedule(
        graph,
        { workerPool: readyWorkerPool(3), metadataConcurrency: 2 },
        async ({ node }) => {
          await new Promise((resolve) =>
            setTimeout(resolve, pseudoRandomDelay(seed, node.id)),
          );
          if (node.id === 'bravo' || node.id === 'delta')
            return { kind: 'failed', message: `failed:${node.id}` };
          return { kind: 'completed', artifact: `artifact:${node.id}` };
        },
      );
      signatures.push(
        JSON.stringify({
          nodes: result.nodes,
          artifacts: result.artifacts,
          errors: result.errors,
          metrics: result.metrics,
        }),
      );
    }

    expect(new Set(signatures)).toHaveLength(1);
    const result = JSON.parse(signatures[0]!) as {
      errors: { nodeId: string }[];
      artifacts: { nodeId: string }[];
    };
    expect(result.errors.map(({ nodeId }) => nodeId)).toEqual([
      'bravo',
      'delta',
    ]);
    expect(result.artifacts.map(({ nodeId }) => nodeId)).toEqual([
      'source',
      'alpha',
      'charlie',
    ]);
  });
});

/**
 * Handles pseudo random delay in the pipeline parallel compilation flow.
 */
function pseudoRandomDelay(seed: number, nodeId: string): number {
  let value = seed * 1103515245 + 12345;
  for (const character of nodeId)
    value = (value ^ character.charCodeAt(0)) * 33;
  return Math.abs(value) % 7;
}
