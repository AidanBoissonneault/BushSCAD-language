/**
 * @author Aidan Boissonneault
 * @file json.ts
 * @purpose Provides json behavior for the reporting in model analysis package.
 * @last-edited October 6, 2026
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  ModelAnalysisResult,
  ModelComparisonResult,
} from '../types/types.js';

/**
 * Writes stable, readable JSON for reports and baselines.
 * Baseline diffs should be reviewable in git and prompt-friendly when copied
 * into a debugging conversation.
 */
export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/**
 * Handles serializable in the reporting flow.
 */
export function serializable(value: unknown): unknown {
  if (ArrayBuffer.isView(value)) return Array.from(value as Uint8Array);
  if (Array.isArray(value)) return value.map(serializable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, next]) => [key, serializable(next)]),
  );
}

/**
 * Compacts analysis while preserving its values.
 */
export function compactAnalysis(
  result: ModelAnalysisResult,
):
  | Omit<Extract<ModelAnalysisResult, { ok: true }>, 'rawMeshes'>
  | ModelAnalysisResult {
  if (!result.ok) return result;
  const { rawMeshes: _rawMeshes, ...compact } = result;
  return compact;
}

/**
 * Compacts comparison while preserving its values.
 */
export function compactComparison(
  result: ModelComparisonResult,
): ModelComparisonResult | Record<string, unknown> {
  if (!result.ok)
    return { ...result, current: compactAnalysis(result.current) };
  return {
    ...result,
    current: compactAnalysis(result.current),
  };
}
