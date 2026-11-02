/**
 * @author Aidan Boissonneault
 * @file build-trace.test.ts
 * @purpose Tests build trace behavior in the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { IROp } from '@bushscad/ir';
import {
  createOcctBuildTrace,
  pushTraceEvent,
  pushOpStart,
  pushOpSuccess,
  snapshotBodies,
} from '../../src/operations/build-trace.js';
import type { GroupBuildState } from '../../src/bridge/bridge-types.js';

/**
 * Constructs state from the supplied values.
 */
function makeState(entries: Array<[string, unknown]>): GroupBuildState {
  return {
    bodyShapes: new Map(entries),
  } as GroupBuildState;
}

/**
 * Constructs op from the supplied values.
 */
function makeOp(): IROp {
  return {
    kind: 'heal',
    target: 'body',
    tolerance: 0.01,
    span: { file: 'part.bscd', line: 4, col: 2 },
  };
}

describe('build trace', () => {
  it('diffs added, removed, and modified body names', () => {
    const trace = createOcctBuildTrace();
    const stable = {};
    const oldBody = {};
    const newBody = {};
    const before = snapshotBodies(
      makeState([
        ['body', oldBody],
        ['stable', stable],
        ['removed', {}],
      ]),
    );
    const after = snapshotBodies(
      makeState([
        ['body', newBody],
        ['stable', stable],
        ['added', {}],
      ]),
    );

    pushOpSuccess(trace, 'part', makeOp(), before, after, 12);

    expect(trace.events[0]).toMatchObject({
      kind: 'op-success',
      partName: 'part',
      addedBodies: ['added'],
      removedBodies: ['removed'],
      modifiedBodies: ['body'],
    });
  });

  it('streams events as they are pushed', () => {
    const streamed: string[] = [];
    const trace = createOcctBuildTrace((event) => {
      streamed.push(event.kind);
    });

    pushTraceEvent(trace, { kind: 'build-start' });

    expect(streamed).toEqual(['build-start']);
    expect(trace.events[0].kind).toBe('build-start');
  });

  it('traces requested selector kind, resolved topology, count, and span', () => {
    const trace = createOcctBuildTrace();
    const span = {
      file: 'surface.bscd',
      line: 3,
      col: 20,
      endLine: 3,
      endCol: 35,
    };
    const op: IROp = {
      kind: 'surface',
      name: 'skin',
      boundary: 'plate.top.edges',
      selection: {
        requestedKind: 'face-edges',
        ownerEntity: 'plate',
        sourceSpan: span,
        targets: [
          {
            id: 'plate:face-edges:plate.top.edges',
            label: 'plate.top.edges',
            ownerEntity: 'plate',
            selectorKind: 'face-edges',
            topologyKind: 'edge',
            source: { selectorSpan: span, segmentSpans: [] },
          },
        ],
      },
      span,
    };

    pushOpStart(trace, 'part', op, snapshotBodies(makeState([])));

    expect(trace.events[0]).toMatchObject({
      kind: 'selector-resolution',
      requestedSelectorKind: 'face-edges',
      resolvedTopologyKind: 'edge',
      selectorLabel: 'plate.top.edges',
      matchCount: 1,
      span,
    });
  });
});
