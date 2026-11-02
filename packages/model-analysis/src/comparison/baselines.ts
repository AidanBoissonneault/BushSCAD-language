/**
 * @author Aidan Boissonneault
 * @file baselines.ts
 * @purpose Provides baselines behavior for the comparison in model analysis package.
 * @last-edited October 6, 2026
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type {
  ModelAnalysisResult,
  ModelBaselineResult,
} from '../types/types.js';
import { analyzeModel } from '../analysis/modelAnalysis.js';
import { serializable } from '../reporting/json.js';

/**
 * Options for baseline, including source file path, name, env, workspace root, and baseline
 * root.
 */
type BaselineOptions = {
  filePath: string;
  name: string;
  env?: Record<string, string>;
  rootPath?: string | null;
  baselineRoot?: string;
  width?: number;
  height?: number;
};

/**
 * Handles baseline path in the comparison flow.
 */
export function baselinePath(
  name: string,
  root = '.bushscad-analysis',
): string {
  return resolve(root, 'baselines', `${name}.json`);
}

/**
 * Writes a saved geometry baseline for future comparisons.
 * Baselines make repeated geometry fixes measurable and prevent accidental
 * persistence of broken output across edits.
 */
export async function writeBaseline(
  options: BaselineOptions,
): Promise<ModelBaselineResult> {
  const path = baselinePath(options.name, options.baselineRoot);
  const outDir = join(
    resolve(options.baselineRoot ?? '.bushscad-analysis'),
    'runs',
    options.name,
  );
  const analysis = await analyzeModel({ ...options, outDir });
  if (!analysis.ok) throw new Error('Cannot baseline a failed analysis');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(
    path,
    `${JSON.stringify(serializable(analysis), null, 2)}\n`,
    'utf8',
  );
  return { ok: true, baselinePath: path, analysis };
}

/**
 * Reads baseline from the supplied source.
 */
export async function readBaseline(path: string): Promise<ModelAnalysisResult> {
  return JSON.parse(await readFile(path, 'utf8')) as ModelAnalysisResult;
}
