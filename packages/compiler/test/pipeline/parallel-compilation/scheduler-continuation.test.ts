/**
 * @author Aidan Boissonneault
 * @file scheduler-continuation.test.ts
 * @purpose Tests scheduler continuation behavior in the pipeline parallel compilation in compiler package.
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

/**
 * Handles continuation graph in the pipeline parallel compilation flow.
 */
function continuationGraph() {
  return schedulerGraph(
    [
      schedulerNode('source', 0, { estimatedCost: 'metadata' }),
      schedulerNode('resume', 1, { continuation: true }),
      schedulerNode('output', 3, { estimatedCost: 'metadata' }),
    ],
    [schedulerEdge('source', 'resume'), schedulerEdge('resume', 'output')],
  );
}

describe('parallel scheduler continuation boundaries', () => {
  it('adds, validates, executes, and requeues a stable dynamic subgraph', async () => {
    const executions: string[] = [];
    const result = await simulateCompilationSchedule(
      continuationGraph(),
      { workerPool: readyWorkerPool(2) },
      ({ node, attempt }) => {
        executions.push(`${node.id}:${attempt}`);
        if (node.id === 'resume' && attempt === 1) {
          const child = schedulerNode('dynamic-child', 2, {
            writes: ['dynamic:value'],
          });
          return {
            kind: 'continuation',
            extension: {
              nodes: [child],
              edges: [
                schedulerEdge('source', child.id),
                schedulerEdge(child.id, 'resume', 'shape', 'dynamic:value'),
              ],
            },
          };
        }
        return { kind: 'completed', artifact: `${node.id}:${attempt}` };
      },
    );

    expect(result.ok).toBe(true);
    expect(executions).toEqual([
      'source:1',
      'resume:1',
      'dynamic-child:1',
      'resume:2',
      'output:1',
    ]);
    expect(result.nodes).toMatchObject([
      { nodeId: 'source', attempts: 1, status: 'completed' },
      { nodeId: 'resume', attempts: 2, status: 'completed' },
      { nodeId: 'dynamic-child', attempts: 1, status: 'completed' },
      { nodeId: 'output', attempts: 1, status: 'completed' },
    ]);
    expect(result.metrics.continuationCount).toBe(1);
    expect(
      result.graph.nodes.find(({ id }) => id === 'resume')?.reads,
    ).toContain('dynamic:value');
  });

  it('rejects a continuation cycle at the suspended node span', async () => {
    const result = await simulateCompilationSchedule(
      continuationGraph(),
      { workerPool: readyWorkerPool(1) },
      ({ node }) => {
        if (node.id !== 'resume') return { kind: 'completed' };
        const child = schedulerNode('cycle-child', 2);
        return {
          kind: 'continuation',
          extension: {
            nodes: [child],
            edges: [
              schedulerEdge('resume', child.id),
              schedulerEdge(child.id, 'resume'),
            ],
          },
        };
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toMatchObject([
      {
        code: 'invalid-continuation',
        nodeId: 'resume',
        span: { file: 'scheduler-fixture.bscd', line: 2, col: 1 },
      },
    ]);
    expect(result.errors[0]?.message).toContain('cycle');
    expect(result.nodes.find(({ nodeId }) => nodeId === 'output')?.status).toBe(
      'cancelled',
    );
  });
});
