/**
 * @author Aidan Boissonneault
 * @file scheduler-priority.test.ts
 * @purpose Tests scheduler priority behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  analyzeSchedulerPriority,
  rankReadySchedulerNodes,
} from '../../../src/index.js';
import {
  schedulerEdge,
  schedulerGraph,
  schedulerNode,
} from '../../fixtures/parallel-compilation/scheduler-graphs.js';

describe('parallel scheduler priority tuple', () => {
  it('prefers the longest critical path before source order', () => {
    const short = schedulerNode('short', 0, { estimatedCost: 'heavy' });
    const long = schedulerNode('long', 1, { estimatedCost: 'medium' });
    const longTail = schedulerNode('long-tail', 2, {
      estimatedCost: 'heavy',
    });
    const output = schedulerNode('output', 3, { estimatedCost: 'metadata' });
    const graph = schedulerGraph(
      [short, long, longTail, output],
      [
        schedulerEdge('long', 'long-tail'),
        schedulerEdge('short', 'output'),
        schedulerEdge('long-tail', 'output'),
      ],
    );
    const remaining = new Map([
      ['short', 0],
      ['long', 0],
      ['long-tail', 1],
      ['output', 2],
    ]);
    const ranked = rankReadySchedulerNodes(
      [short, long],
      analyzeSchedulerPriority(graph),
      remaining,
    );
    expect(ranked.map(({ id }) => id)).toEqual(['long', 'short']);
  });

  it('promotes every dependency of an active preview requirement', () => {
    const ordinary = schedulerNode('ordinary', 0, { estimatedCost: 'heavy' });
    const activeRoot = schedulerNode('active-root', 1, {
      estimatedCost: 'light',
    });
    const activeOutput = schedulerNode('active-output', 2, {
      estimatedCost: 'light',
    });
    const output = schedulerNode('output', 3, { estimatedCost: 'metadata' });
    const graph = schedulerGraph(
      [ordinary, activeRoot, activeOutput, output],
      [
        schedulerEdge('active-root', 'active-output'),
        schedulerEdge('ordinary', 'output'),
        schedulerEdge('active-output', 'output'),
      ],
    );
    const analysis = analyzeSchedulerPriority(
      graph,
      new Set(['active-output']),
    );
    expect(analysis.activeRequirementIds).toEqual(
      new Set(['active-output', 'active-root']),
    );
    expect(
      rankReadySchedulerNodes(
        [ordinary, activeRoot],
        analysis,
        new Map([
          ['ordinary', 0],
          ['active-root', 0],
          ['active-output', 1],
          ['output', 2],
        ]),
      ).map(({ id }) => id),
    ).toEqual(['active-root', 'ordinary']);
  });

  it('uses unblock count, lower pressure, source order, and ID as stable ties', () => {
    const moreUnblocks = schedulerNode('more-unblocks', 3, {
      estimatedCost: 'medium',
    });
    const fewerUnblocks = schedulerNode('fewer-unblocks', 0, {
      estimatedCost: 'medium',
    });
    const childA = schedulerNode('child-a', 4, { estimatedCost: 'metadata' });
    const childB = schedulerNode('child-b', 5, { estimatedCost: 'metadata' });
    const childC = schedulerNode('child-c', 6, { estimatedCost: 'metadata' });
    const graph = schedulerGraph(
      [fewerUnblocks, moreUnblocks, childA, childB, childC],
      [
        schedulerEdge('more-unblocks', 'child-a'),
        schedulerEdge('more-unblocks', 'child-b'),
        schedulerEdge('fewer-unblocks', 'child-c'),
      ],
      'child-c',
    );
    const analysis = analyzeSchedulerPriority(graph);
    const remaining = new Map([
      ['more-unblocks', 0],
      ['fewer-unblocks', 0],
      ['child-a', 1],
      ['child-b', 1],
      ['child-c', 1],
    ]);
    expect(
      rankReadySchedulerNodes(
        [fewerUnblocks, moreUnblocks],
        analysis,
        remaining,
      )[0]?.id,
    ).toBe('more-unblocks');

    const light = schedulerNode('z-light', 8, { estimatedCost: 'light' });
    const medium = schedulerNode('a-medium', 7, { estimatedCost: 'medium' });
    const lightTail = schedulerNode('light-tail', 9, {
      estimatedCost: 'medium',
    });
    const mediumTail = schedulerNode('medium-tail', 10, {
      estimatedCost: 'light',
    });
    const pressureGraph = schedulerGraph(
      [medium, light, lightTail, mediumTail],
      [
        schedulerEdge('z-light', 'light-tail'),
        schedulerEdge('a-medium', 'medium-tail'),
      ],
      'medium-tail',
    );
    expect(
      rankReadySchedulerNodes(
        [medium, light],
        analyzeSchedulerPriority(pressureGraph),
        new Map([
          ['z-light', 0],
          ['a-medium', 0],
          ['light-tail', 1],
          ['medium-tail', 1],
        ]),
      )[0]?.id,
    ).toBe('z-light');
  });
});
