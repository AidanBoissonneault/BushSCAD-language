/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for model analysis package.
 * @last-edited October 6, 2026
 */

export { analyzeModel } from './analysis/modelAnalysis.js';
export { writeBaseline } from './comparison/baselines.js';
export { compareModel, compareMeshes } from './comparison/compare.js';
export { runLanguageSuite } from './suite/runSuite.js';
export { languageCapabilityCatalog } from './suite/capabilityCatalog.js';
export type {
  MeshAnalysis,
  MeshComparison,
  ModelAnalysisOptions,
  ModelAnalysisResult,
  ModelBaselineResult,
  ModelComparisonResult,
} from './types/types.js';
export type {
  SuiteCaseResult,
  SuiteManifest,
  SuiteRunOptions,
  SuiteRunResult,
} from './suite/suiteTypes.js';
