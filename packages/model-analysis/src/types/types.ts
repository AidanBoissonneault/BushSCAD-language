/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the types in model analysis package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  MeshData,
  OcctTraceEvent,
  SourceSpan,
  ValidationResult,
} from '@bushscad/ir';

/**
 * Bounds3, including min and max.
 */
export type Bounds3 = {
  min: [number, number, number];
  max: [number, number, number];
};

/**
 * Summary of mesh issue, including degenerate triangles, invalid normals, boundary edges, non
 * manifold edges, and disconnected components.
 */
export type MeshIssueSummary = {
  degenerateTriangles: number;
  invalidNormals: number;
  boundaryEdges: number;
  nonManifoldEdges: number;
  disconnectedComponents: number;
};

/**
 * Slice sample, including z, 3D bounds, centroid, area estimate, and contour segments.
 */
export type SliceSample = {
  z: number;
  bounds: Bounds3 | null;
  centroid: [number, number, number] | null;
  areaEstimate: number;
  contourSegments: number;
};

/**
 * Slice warning, including mesh key, z, and message.
 */
export type SliceWarning = {
  meshKey: string;
  z: number;
  message: string;
};

/**
 * Mesh analysis, including key, part name, body name, vertex count, and triangle count.
 */
export type MeshAnalysis = {
  key: string;
  partName: string;
  bodyName: string | null;
  vertexCount: number;
  triangleCount: number;
  bounds: Bounds3;
  center: [number, number, number];
  dimensions: [number, number, number];
  surfaceArea: number;
  signedVolume: number;
  issues: MeshIssueSummary;
  slices: SliceSample[];
};

/**
 * Options for model analysis, including source file path, workspace root, out dir, env, and
 * width.
 */
export type ModelAnalysisOptions = {
  filePath: string;
  rootPath?: string | null;
  outDir?: string;
  env?: Record<string, string>;
  width?: number;
  height?: number;
  writeReport?: boolean;
};

/**
 * Summary of model operation, including operation kind, name, and span.
 */
export type ModelOperationSummary = {
  kind: string;
  name: string | null;
  span: SourceSpan;
};

/**
 * Result of model analysis is tagged by ok: 'true' carries meshes, warnings, validations and
 * 'false' carries errors.
 */
export type ModelAnalysisResult =
  | {
      ok: true;
      filePath: string;
      env: Record<string, string>;
      elapsedMs: number;
      meshes: MeshAnalysis[];
      warnings: SliceWarning[];
      validations: ValidationResult[];
      operations: ModelOperationSummary[];
      drawingCount: number;
      jointCount: number;
      occtTraceEvents: OcctTraceEvent[];
      rawMeshes: MeshData[];
      outDir?: string;
      screenshots: string[];
    }
  | {
      ok: false;
      filePath: string;
      env: Record<string, string>;
      elapsedMs: number;
      errors: CompileError[];
      occtTraceEvents: OcctTraceEvent[];
      outDir?: string;
      screenshots: string[];
    };

/**
 * Result of model baseline, including success flag, baseline path, and analysis.
 */
export type ModelBaselineResult = {
  ok: true;
  baselinePath: string;
  analysis: Extract<ModelAnalysisResult, { ok: true }>;
};

/**
 * Mesh comparison, including key, missing in baseline, missing in current, triangle delta, and
 * vertex delta.
 */
export type MeshComparison = {
  key: string;
  missingInBaseline: boolean;
  missingInCurrent: boolean;
  triangleDelta: number;
  vertexDelta: number;
  surfaceAreaDelta: number;
  signedVolumeDelta: number;
  dimensionDeltas: [number, number, number];
  issueDeltas: MeshIssueSummary;
};

/**
 * Result of model comparison is tagged by ok: 'true' carries comparisons and 'false'.
 */
export type ModelComparisonResult =
  | {
      ok: true;
      baselinePath: string;
      current: Extract<ModelAnalysisResult, { ok: true }>;
      comparisons: MeshComparison[];
      outDir?: string;
    }
  | {
      ok: false;
      baselinePath: string;
      current: ModelAnalysisResult;
      outDir?: string;
    };
