/**
 * @author Aidan Boissonneault
 * @file reportData.ts
 * @purpose Provides report data behavior for the reporting in model analysis package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';
import type { ModelAnalysisResult } from '../types/types.js';

/**
 * Report mesh, including key, part name, body name, color, and vertices.
 */
type ReportMesh = {
  key: string;
  partName: string;
  bodyName: string | null;
  color: string;
  vertices: number[];
  indices: number[];
};

/**
 * Report data, including analysis and meshes.
 */
export type ReportData = {
  analysis: Omit<Extract<ModelAnalysisResult, { ok: true }>, 'rawMeshes'>;
  meshes: ReportMesh[];
};

/**
 * Converts typed-array mesh buffers into browser-embeddable report data.
 * The HTML report must be standalone so Playwright and humans can open it
 * without a dev server.
 */
export function makeReportData(
  analysis: Extract<ModelAnalysisResult, { ok: true }>,
  meshes: MeshData[],
): ReportData {
  const { rawMeshes: _rawMeshes, ...summary } = analysis;
  return {
    analysis: summary,
    meshes: meshes.map((mesh) => ({
      key: `${mesh.partName}:${mesh.bodyName ?? mesh.partName}`,
      partName: mesh.partName,
      bodyName: mesh.bodyName ?? null,
      color: mesh.color,
      vertices: Array.from(mesh.vertices),
      indices: Array.from(mesh.indices),
    })),
  };
}
