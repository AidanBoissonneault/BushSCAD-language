/**
 * @author Aidan Boissonneault
 * @file analyzeMesh.ts
 * @purpose Provides analyze mesh behavior for the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';
import type { MeshAnalysis, SliceWarning } from '../types/types.js';
import { meshKey } from './meshAccess.js';
import { computeMeshMetrics } from './meshMetrics.js';
import { analyzeTopology } from './topology.js';
import { analyzeSlices, sliceWarnings } from './slices.js';

/**
 * Mesh analysis bundle, including analyses and warnings.
 */
type MeshAnalysisBundle = {
  analyses: MeshAnalysis[];
  warnings: SliceWarning[];
};

/**
 * Converts preview meshes into diagnostics.
 * The rest of the tool should operate on compact analysis records instead of
 * repeatedly walking large typed arrays.
 */
export function analyzeMeshes(meshes: MeshData[]): MeshAnalysisBundle {
  const analyses: MeshAnalysis[] = [];
  const warnings: SliceWarning[] = [];
  for (const mesh of meshes) {
    const metrics = computeMeshMetrics(mesh);
    const topology = analyzeTopology(mesh);
    const slices = analyzeSlices(mesh);
    analyses.push({
      key: meshKey(mesh),
      partName: mesh.partName,
      bodyName: mesh.bodyName ?? null,
      vertexCount: mesh.vertices.length / 3,
      triangleCount: mesh.indices.length / 3,
      bounds: metrics.bounds,
      center: metrics.center,
      dimensions: metrics.dimensions,
      surfaceArea: metrics.surfaceArea,
      signedVolume: metrics.signedVolume,
      issues: {
        degenerateTriangles: metrics.degenerateTriangles,
        invalidNormals: metrics.invalidNormals,
        ...topology,
      },
      slices,
    });
    warnings.push(...sliceWarnings(mesh, slices));
  }
  return { analyses, warnings };
}
