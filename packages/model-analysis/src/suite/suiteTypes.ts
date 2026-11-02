/**
 * @author Aidan Boissonneault
 * @file suiteTypes.ts
 * @purpose Provides suite types behavior for the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import type { CompileError, SourceSpan, ValidationResult } from '@bushscad/ir';
import type { MeshAnalysis, MeshIssueSummary } from '../types/types.js';

/**
 * Suite expectation, including min meshes, max meshes, min triangles, min absolute volume, and
 * required parts.
 */
export type SuiteExpectation = {
  minMeshes?: number;
  maxMeshes?: number;
  minTriangles?: number;
  minAbsoluteVolume?: number;
  requiredParts?: string[];
  requiredOperations?: string[];
  requiredChangedOperations?: string[];
  requiredChangedModifiers?: SuiteModifierEffect[];
  maxWarnings?: number;
  maxTopologyIssues?: Partial<MeshIssueSummary>;
  requiredMeshMetricDifferences?: SuiteMeshMetricDifference[];
  allowBoundaryEdges?: boolean;
  allowDisconnectedComponents?: boolean;
};

/**
 * Suite modifier effect, including part name, operation kind, and target.
 */
export type SuiteModifierEffect = {
  partName: string;
  kind: 'fillet' | 'chamfer';
  target: string;
};

/**
 * Suite mesh metric difference, including left body, right body, metric, and minimum difference.
 */
export type SuiteMeshMetricDifference = {
  leftBody: string;
  rightBody: string;
  metric: 'triangleCount' | 'surfaceArea' | 'absoluteVolume';
  minimumDifference?: number;
};

/**
 * Suite case manifest, including identifier, title, description, file, and capabilities.
 */
export type SuiteCaseManifest = {
  id: string;
  title: string;
  description: string;
  file: string;
  capabilities: string[];
  env?: Record<string, string>;
  expectations?: SuiteExpectation;
};

/**
 * Suite manifest, including version, title, description, and cases.
 */
export type SuiteManifest = {
  version: 1;
  title: string;
  description: string;
  cases: SuiteCaseManifest[];
};

/**
 * Suite check, including name, passed, and additional detail.
 */
export type SuiteCheck = {
  name: string;
  passed: boolean;
  detail: string;
};

/**
 * Suite operation, including operation kind, name, and span.
 */
export type SuiteOperation = {
  kind: string;
  name: string | null;
  span: SourceSpan;
};

/**
 * Result of suite case, including identifier, title, description, source file path, and
 * capabilities.
 */
export type SuiteCaseResult = {
  id: string;
  title: string;
  description: string;
  filePath: string;
  capabilities: string[];
  status: 'passed' | 'failed';
  elapsedMs: number;
  checks: SuiteCheck[];
  errors: CompileError[];
  validations: ValidationResult[];
  meshes: MeshAnalysis[];
  operations: SuiteOperation[];
  warnings: string[];
  screenshots: string[];
  artifactDirectory: string;
  source: string;
};

/**
 * Suite coverage, including required, covered, missing, and unknown.
 */
export type SuiteCoverage = {
  required: string[];
  covered: string[];
  missing: string[];
  unknown: string[];
};

/**
 * Result of suite run, including success flag, title, description, suite root, and out dir.
 */
export type SuiteRunResult = {
  ok: boolean;
  title: string;
  description: string;
  suiteRoot: string;
  outDir: string;
  startedAt: string;
  elapsedMs: number;
  coverage: SuiteCoverage;
  manifestChecks: SuiteCheck[];
  cases: SuiteCaseResult[];
  reportJsonPath: string;
  reportHtmlPath: string;
  reportPdfPath: string;
};

/**
 * Options for suite run, including suite root, out dir, width, and height.
 */
export type SuiteRunOptions = {
  suiteRoot: string;
  outDir: string;
  width?: number;
  height?: number;
};
