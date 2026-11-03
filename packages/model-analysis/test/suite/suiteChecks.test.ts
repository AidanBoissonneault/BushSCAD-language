/**
 * @author Aidan Boissonneault
 * @file suiteChecks.test.ts
 * @purpose Tests suite checks behavior in the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { ModelAnalysisResult } from '../../src/types/types.js';
import {
  evaluateSuiteCase,
  traceEventChangedBodyIdentity,
} from '../../src/suite/suiteChecks.js';
import type { SuiteCaseManifest } from '../../src/suite/suiteTypes.js';

const ENTRY: SuiteCaseManifest = {
  id: 'physical-check',
  title: 'Physical check',
  description: 'Test fixture',
  file: 'fixture.bscd',
  capabilities: [],
};

/**
 * Handles successful analysis in the suite flow.
 */
function successfulAnalysis(): Extract<ModelAnalysisResult, { ok: true }> {
  return {
    ok: true,
    filePath: 'fixture.bscd',
    env: {},
    elapsedMs: 10,
    meshes: [
      {
        key: 'part',
        partName: 'part',
        bodyName: 'body',
        vertexCount: 6,
        triangleCount: 2,
        bounds: { min: [0, 0, 0], max: [1, 1, 1] },
        center: [0.5, 0.5, 0.5],
        dimensions: [1, 1, 1],
        surfaceArea: 6,
        signedVolume: 1,
        issues: {
          degenerateTriangles: 2,
          invalidNormals: 0,
          boundaryEdges: 4,
          nonManifoldEdges: 0,
          disconnectedComponents: 1,
        },
        slices: [],
      },
    ],
    warnings: [],
    validations: [],
    operations: [{ kind: 'extrude', name: 'body', span: SPAN }],
    drawingCount: 0,
    jointCount: 0,
    occtTraceEvents: [
      {
        kind: 'op-success',
        timestampMs: 5,
        opKind: 'extrude',
        modifiedBodies: ['body'],
      },
    ],
    rawMeshes: [],
    screenshots: ['1', '2', '3', '4', '5', '6'],
  };
}

const SPAN = { file: 'fixture.bscd', line: 1, col: 1 };

describe('language suite checks', () => {
  it('detects each successful body identity change shape', () => {
    expect(
      traceEventChangedBodyIdentity({
        kind: 'op-success',
        timestampMs: 1,
        opKind: 'fuse',
        addedBodies: ['joined'],
      }),
    ).toBe(true);
    expect(
      traceEventChangedBodyIdentity({
        kind: 'op-success',
        timestampMs: 2,
        opKind: 'cut',
        modifiedBodies: ['body'],
      }),
    ).toBe(true);
    expect(
      traceEventChangedBodyIdentity({
        kind: 'op-success',
        timestampMs: 3,
        opKind: 'remove',
        removedBodies: ['tool'],
      }),
    ).toBe(true);
    expect(
      traceEventChangedBodyIdentity({
        kind: 'op-success',
        timestampMs: 4,
        opKind: 'noop',
      }),
    ).toBe(false);
    expect(
      traceEventChangedBodyIdentity({
        kind: 'op-error',
        timestampMs: 5,
        opKind: 'fuse',
        addedBodies: ['ignored'],
      }),
    ).toBe(false);
  });

  it('checks declared operations and geometry-changing trace events', () => {
    const analysis = successfulAnalysis();
    analysis.meshes.push({
      ...analysis.meshes[0],
      key: 'comparison',
      bodyName: 'comparison',
      triangleCount: 4,
    });
    analysis.occtTraceEvents.push({
      kind: 'op-success',
      timestampMs: 6,
      partName: 'part',
      opKind: 'modifiers',
      opName: 'fillet:body.perimeter',
      modifiedBodies: ['body'],
    });
    const checks = evaluateSuiteCase(
      {
        ...ENTRY,
        expectations: {
          requiredOperations: ['extrude'],
          requiredChangedOperations: ['extrude'],
          requiredChangedModifiers: [
            { partName: 'part', kind: 'fillet', target: 'body.perimeter' },
          ],
          maxTopologyIssues: { degenerateTriangles: 4, boundaryEdges: 8 },
          requiredMeshMetricDifferences: [
            {
              leftBody: 'body',
              rightBody: 'comparison',
              metric: 'triangleCount',
              minimumDifference: 1,
            },
          ],
        },
      },
      analysis,
    );

    expect(checks.every((check) => check.passed)).toBe(true);
  });

  it('fails when a topology issue exceeds its explicit ceiling', () => {
    const checks = evaluateSuiteCase(
      {
        ...ENTRY,
        expectations: {
          maxTopologyIssues: { degenerateTriangles: 1, boundaryEdges: 4 },
        },
      },
      successfulAnalysis(),
    );

    expect(
      checks.find((check) => check.name === 'Topology health')?.passed,
    ).toBe(false);
  });

  it('recognizes added and removed bodies as geometry changes', () => {
    const analysis = successfulAnalysis();
    analysis.occtTraceEvents.push(
      {
        kind: 'op-success',
        timestampMs: 6,
        opKind: 'fuse',
        addedBodies: ['joined'],
      },
      {
        kind: 'op-success',
        timestampMs: 7,
        opKind: 'cut',
        removedBodies: ['tool'],
      },
      {
        kind: 'op-error',
        timestampMs: 8,
        opKind: 'shell',
        addedBodies: ['ignored'],
      },
    );

    const checks = evaluateSuiteCase(
      {
        ...ENTRY,
        expectations: { requiredChangedOperations: ['fuse', 'cut'] },
      },
      analysis,
    );

    expect(
      checks.find((check) => check.name === 'Geometry-changing operations')
        ?.passed,
    ).toBe(true);
  });

  it('fails a modifier target that reports success without changing a body', () => {
    const analysis = successfulAnalysis();
    analysis.occtTraceEvents.push({
      kind: 'op-success',
      timestampMs: 6,
      partName: 'part',
      opKind: 'modifiers',
      opName: 'fillet:body.perimeter',
      modifiedBodies: [],
    });
    const checks = evaluateSuiteCase(
      {
        ...ENTRY,
        expectations: {
          maxTopologyIssues: { degenerateTriangles: 2, boundaryEdges: 4 },
          requiredChangedModifiers: [
            { partName: 'part', kind: 'fillet', target: 'body.perimeter' },
          ],
        },
      },
      analysis,
    );

    expect(
      checks.find(
        (check) => check.name === 'Geometry-changing modifier targets',
      )?.passed,
    ).toBe(false);
  });
});
