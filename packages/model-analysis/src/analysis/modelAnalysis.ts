/**
 * @author Aidan Boissonneault
 * @file modelAnalysis.ts
 * @purpose Provides model analysis behavior for the analysis in model analysis package.
 * @last-edited October 6, 2026
 */

import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  ModelAnalysisOptions,
  ModelAnalysisResult,
} from '../types/types.js';
import { analyzeMeshes } from './analyzeMesh.js';
import { buildPreview } from '../rendering/preview.js';
import { compactAnalysis, writeJson } from '../reporting/json.js';
import { makeReportData } from '../reporting/reportData.js';
import { writeReportHtml } from '../reporting/reportHtml.js';
import { captureScreenshots } from '../rendering/screenshots.js';
import type { IROp } from '@bushscad/ir';
import type { ModelOperationSummary } from '../types/types.js';

/**
 * Builds and analyzes a BushSCAD model.
 * This is the public entrypoint that ties compiler preview, mesh diagnostics,
 * report writing, and screenshot generation into one repeatable run.
 */
export async function analyzeModel(
  options: ModelAnalysisOptions,
): Promise<ModelAnalysisResult> {
  const t0 = Date.now();
  const env = options.env ?? {};
  const outDir = options.outDir ? resolve(options.outDir) : undefined;
  if (outDir) await mkdir(outDir, { recursive: true });
  const preview = await buildPreview(options);
  if (!preview.ok) {
    const failed: ModelAnalysisResult = {
      ok: false,
      filePath: resolve(options.filePath),
      env,
      elapsedMs: Date.now() - t0,
      errors: preview.errors,
      occtTraceEvents: preview.occtTraceEvents ?? [],
      outDir,
      screenshots: [],
    };
    if (outDir) await writeJson(join(outDir, 'analysis.json'), failed);
    return failed;
  }

  const { analyses, warnings } = analyzeMeshes(preview.meshes);
  const result: ModelAnalysisResult = {
    ok: true,
    filePath: resolve(options.filePath),
    env,
    elapsedMs: Date.now() - t0,
    meshes: analyses,
    warnings,
    validations: preview.validations,
    operations: preview.program.ops.map(summarizeOperation),
    drawingCount: preview.drawings.length,
    jointCount: preview.joints.length,
    occtTraceEvents: preview.occtTraceEvents ?? [],
    rawMeshes: preview.meshes,
    outDir,
    screenshots: [],
  };
  if (outDir) await writeOutputs(outDir, result, options);
  return result;
}

/**
 * Handles summarize operation in the analysis flow.
 */
function summarizeOperation(op: IROp): ModelOperationSummary {
  const named = op as {
    name?: string;
    objName?: string;
    target?: string;
    sketchName?: string;
    fitName?: string;
  };
  return {
    kind: op.kind,
    name:
      named.objName ??
      named.name ??
      named.target ??
      named.sketchName ??
      named.fitName ??
      null,
    span: op.span,
  };
}

/**
 * Writes outputs to the configured destination.
 */
async function writeOutputs(
  outDir: string,
  result: Extract<ModelAnalysisResult, { ok: true }>,
  options: ModelAnalysisOptions,
): Promise<void> {
  await writeJson(join(outDir, 'analysis.json'), compactAnalysis(result));
  const reportPath = join(outDir, 'report.html');
  await writeReportHtml(reportPath, makeReportData(result, result.rawMeshes));
  result.screenshots = await captureScreenshots({
    reportPath,
    outDir: join(outDir, 'screenshots'),
    width: options.width ?? 1280,
    height: options.height ?? 900,
  });
  await writeJson(join(outDir, 'analysis.json'), compactAnalysis(result));
}
