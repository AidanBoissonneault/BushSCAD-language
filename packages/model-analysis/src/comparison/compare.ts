/**
 * @author Aidan Boissonneault
 * @file compare.ts
 * @purpose Provides compare behavior for the comparison in model analysis package.
 * @last-edited October 6, 2026
 */

import { join } from 'node:path';
import type { MeshData } from '@bushscad/ir';
import type {
  MeshAnalysis,
  MeshComparison,
  MeshIssueSummary,
  ModelComparisonResult,
} from '../types/types.js';
import { analyzeModel } from '../analysis/modelAnalysis.js';
import { baselinePath, readBaseline } from './baselines.js';
import { compactComparison, writeJson } from '../reporting/json.js';
import { makeReportData } from '../reporting/reportData.js';
import { writeReportHtml } from '../reporting/reportHtml.js';
import { captureScreenshots } from '../rendering/screenshots.js';

const ISSUE_KEYS = [
  'degenerateTriangles',
  'invalidNormals',
  'boundaryEdges',
  'nonManifoldEdges',
  'disconnectedComponents',
] satisfies (keyof MeshIssueSummary)[];

/**
 * Options for compare, including source file path, baseline, out dir, env, and workspace root.
 */
type CompareOptions = {
  filePath: string;
  baseline: string;
  outDir?: string;
  env?: Record<string, string>;
  rootPath?: string | null;
  width?: number;
  height?: number;
};

/**
 * Compares a current model run to a saved baseline.
 *
 * Regression work needs direct deltas for changed bodies instead of relying on
 * memory of what a previous render looked like.
 */
export async function compareModel(
  options: CompareOptions,
): Promise<ModelComparisonResult> {
  const path = baselinePath(options.baseline);
  const current = await analyzeModel(options);
  if (!current.ok)
    return { ok: false, baselinePath: path, current, outDir: options.outDir };
  const baseline = await readBaseline(path);
  if (!baseline.ok)
    return { ok: false, baselinePath: path, current, outDir: options.outDir };
  const comparisons = compareMeshes(baseline.meshes, current.meshes);
  const result: ModelComparisonResult = {
    ok: true,
    baselinePath: path,
    current,
    comparisons,
    outDir: options.outDir,
  };
  if (options.outDir) {
    await writeJson(
      join(options.outDir, 'comparison.json'),
      compactComparison(result),
    );
    await writeComparisonReport(options.outDir, baseline, current, options);
  }
  return result;
}

/**
 * Compares meshes using the requested criteria.
 */
export function compareMeshes(
  baseline: MeshAnalysis[],
  current: MeshAnalysis[],
): MeshComparison[] {
  const baseMap = new Map(baseline.map((mesh) => [mesh.key, mesh]));
  const currentMap = new Map(current.map((mesh) => [mesh.key, mesh]));
  const keys = [...new Set([...baseMap.keys(), ...currentMap.keys()])].sort();
  return keys.map((key) =>
    compareMesh(key, baseMap.get(key), currentMap.get(key)),
  );
}

/**
 * Compares mesh using the requested criteria.
 */
function compareMesh(
  key: string,
  baseline: MeshAnalysis | undefined,
  current: MeshAnalysis | undefined,
): MeshComparison {
  return {
    key,
    ...meshPresence(baseline, current),
    triangleDelta: meshMetricDelta(current, baseline, 'triangleCount'),
    vertexDelta: meshMetricDelta(current, baseline, 'vertexCount'),
    surfaceAreaDelta: meshMetricDelta(current, baseline, 'surfaceArea'),
    signedVolumeDelta: meshMetricDelta(current, baseline, 'signedVolume'),
    dimensionDeltas: deltaVec(current?.dimensions, baseline?.dimensions),
    issueDeltas: deltaIssues(current?.issues, baseline?.issues),
  };
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshPresence(
  baseline: MeshAnalysis | undefined,
  current: MeshAnalysis | undefined,
): Pick<MeshComparison, 'missingInBaseline' | 'missingInCurrent'> {
  return {
    missingInBaseline: !baseline,
    missingInCurrent: !current,
  };
}

/**
 * Builds the mesh data required by the current operation.
 */
function meshMetricDelta(
  current: MeshAnalysis | undefined,
  baseline: MeshAnalysis | undefined,
  metric: 'triangleCount' | 'vertexCount' | 'surfaceArea' | 'signedVolume',
): number {
  return (current?.[metric] ?? 0) - (baseline?.[metric] ?? 0);
}

/**
 * Handles delta vec in the comparison flow.
 */
function deltaVec(
  current: [number, number, number] = [0, 0, 0],
  baseline: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  return [
    current[0] - baseline[0],
    current[1] - baseline[1],
    current[2] - baseline[2],
  ];
}

/**
 * Handles delta issues in the comparison flow.
 */
function deltaIssues(
  current: Partial<MeshIssueSummary> = {},
  baseline: Partial<MeshIssueSummary> = {},
): MeshIssueSummary {
  return Object.fromEntries(
    ISSUE_KEYS.map((key) => [key, issueDelta(key, current, baseline)]),
  ) as MeshIssueSummary;
}

/**
 * Handles issue delta in the comparison flow.
 */
function issueDelta(
  key: keyof MeshIssueSummary,
  current: Partial<MeshIssueSummary>,
  baseline: Partial<MeshIssueSummary>,
): number {
  return (current[key] ?? 0) - (baseline[key] ?? 0);
}

/**
 * Writes comparison report to the configured destination.
 */
async function writeComparisonReport(
  outDir: string,
  baseline: Extract<Awaited<ReturnType<typeof readBaseline>>, { ok: true }>,
  current: Extract<Awaited<ReturnType<typeof analyzeModel>>, { ok: true }>,
  options: CompareOptions,
): Promise<void> {
  const meshes = [
    ...coerceMeshes(baseline).map((mesh) => ({ ...mesh, color: '#ef4444' })),
    ...current.rawMeshes.map((mesh) => ({ ...mesh, color: '#2563eb' })),
  ];
  const reportPath = join(outDir, 'comparison-report.html');
  await writeReportHtml(reportPath, makeReportData(current, meshes));
  await captureScreenshots({
    reportPath,
    outDir: join(outDir, 'comparison-screenshots'),
    width: options.width ?? 1280,
    height: options.height ?? 900,
  });
}

/**
 * Handles coerce meshes in the comparison flow.
 */
function coerceMeshes(
  baseline: Extract<Awaited<ReturnType<typeof readBaseline>>, { ok: true }>,
): MeshData[] {
  const raw = (baseline as { rawMeshes?: unknown[] }).rawMeshes ?? [];
  return raw.map((mesh) => {
    const source = mesh as MeshData & {
      vertices: number[] | Float32Array;
      normals: number[] | Float32Array;
      indices: number[] | Uint32Array;
    };
    return {
      ...source,
      vertices: new Float32Array(source.vertices),
      normals: new Float32Array(source.normals),
      indices: new Uint32Array(source.indices),
    };
  });
}
