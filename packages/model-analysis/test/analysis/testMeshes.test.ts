/**
 * @author Aidan Boissonneault
 * @file testMeshes.test.ts
 * @purpose Tests test meshes behavior in the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { MeshData } from '@bushscad/ir';
import { computeMeshMetrics } from '../../src/analysis/meshMetrics.js';
import { analyzeTopology } from '../../src/analysis/topology.js';
import { compareMeshes } from '../../src/comparison/compare.js';
import { analyzeMeshes } from '../../src/analysis/analyzeMesh.js';

describe('model mesh analysis', () => {
  it('computes bounds, area, and volume for a tetrahedron', () => {
    const metrics = computeMeshMetrics(tetrahedron());
    expect(metrics.bounds).toEqual({ min: [0, 0, 0], max: [1, 1, 1] });
    expect(metrics.surfaceArea).toBeGreaterThan(2);
    expect(Math.abs(metrics.signedVolume)).toBeCloseTo(1 / 6, 5);
    expect(metrics.degenerateTriangles).toBe(0);
  });

  it('detects boundary edges on an open square mesh', () => {
    const topology = analyzeTopology(openSquare());
    expect(topology.boundaryEdges).toBe(4);
    expect(topology.nonManifoldEdges).toBe(0);
    expect(topology.disconnectedComponents).toBe(1);
  });

  it('detects disconnected components', () => {
    const topology = analyzeTopology(twoSquares());
    expect(topology.disconnectedComponents).toBe(2);
  });

  it('builds mesh analysis records and comparison deltas', () => {
    const first = analyzeMeshes([openSquare()]).analyses;
    const second = analyzeMeshes([scaledSquare()]).analyses;
    const comparison = compareMeshes(first, second);
    expect(comparison).toHaveLength(1);
    expect(comparison[0]?.surfaceAreaDelta).toBeGreaterThan(0);
    expect(comparison[0]?.dimensionDeltas[0]).toBe(1);
  });
});

/**
 * Builds the mesh data required by the current operation.
 */
function mesh(
  vertices: number[],
  indices: number[],
  bodyName = 'body',
): MeshData {
  return {
    partName: 'part',
    bodyName,
    color: '#94a3b8',
    vertices: new Float32Array(vertices),
    normals: new Float32Array(
      vertices.map((_, index) => (index % 3 === 2 ? 1 : 0)),
    ),
    indices: new Uint32Array(indices),
  };
}

/**
 * Handles tetrahedron in the analysis flow.
 */
function tetrahedron(): MeshData {
  return mesh(
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3],
  );
}

/**
 * Opens square and initializes its resources.
 */
function openSquare(): MeshData {
  return mesh([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);
}

/**
 * Handles scaled square in the analysis flow.
 */
function scaledSquare(): MeshData {
  return mesh([0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0], [0, 1, 2, 0, 2, 3]);
}

/**
 * Handles two squares in the analysis flow.
 */
function twoSquares(): MeshData {
  return mesh(
    [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 3, 0, 0, 4, 0, 0, 4, 1, 0, 3, 1, 0],
    [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7],
  );
}
