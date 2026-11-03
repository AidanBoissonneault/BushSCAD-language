/**
 * @author Aidan Boissonneault
 * @file runSuite.ts
 * @purpose Provides run suite behavior for the suite in model analysis package.
 * @last-edited October 6, 2026
 */

import { mkdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { analyzeModel } from '../analysis/modelAnalysis.js';
import { writeJson } from '../reporting/json.js';
import { evaluateSuiteCase } from './suiteChecks.js';
import { loadSuiteManifest } from './suiteManifest.js';
import { writeSuitePdf } from './suitePdf.js';
import { writeSuiteReportHtml } from './suiteReportHtml.js';
import type {
  SuiteCaseManifest,
  SuiteCaseResult,
  SuiteRunOptions,
  SuiteRunResult,
} from './suiteTypes.js';

/** Runs every released-language physical model and writes visual review artifacts. */
export async function runLanguageSuite(
  options: SuiteRunOptions,
): Promise<SuiteRunResult> {
  const started = Date.now();
  const startedAt = new Date(started).toISOString();
  const loaded = await loadSuiteManifest(options.suiteRoot);
  assertManifestReady(loaded.checks, loaded.coverage);
  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });

  const cases: SuiteCaseResult[] = [];
  for (const entry of loaded.manifest.cases) {
    cases.push(await runSuiteCase(entry, loaded.suiteRoot, outDir, options));
  }

  const result = suiteResult({
    options,
    outDir,
    started,
    startedAt,
    loaded,
    cases,
  });
  await writeJson(result.reportJsonPath, result);
  await writeSuiteReportHtml(result.reportHtmlPath, result);
  await writeSuitePdf(result.reportHtmlPath, result.reportPdfPath);
  return result;
}

/**
 * Runs case and returns its result.
 */
export async function runSuiteCase(
  entry: SuiteCaseManifest,
  suiteRoot: string,
  outDir: string,
  options: SuiteRunOptions,
): Promise<SuiteCaseResult> {
  const filePath = resolve(suiteRoot, entry.file);
  const artifactDirectory = join(outDir, 'cases', entry.id);
  const source = await readFile(filePath, 'utf8');
  const analysis = await analyzeModel({
    filePath,
    rootPath: suiteRoot,
    outDir: artifactDirectory,
    env: entry.env,
    width: options.width,
    height: options.height,
  });
  const checks = evaluateSuiteCase(entry, analysis);
  const passed = checks.every((check) => check.passed);
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    filePath,
    capabilities: [...entry.capabilities].sort(),
    status: passed ? 'passed' : 'failed',
    elapsedMs: analysis.elapsedMs,
    checks,
    errors: analysis.ok ? [] : analysis.errors,
    validations: analysis.ok ? analysis.validations : [],
    meshes: analysis.ok ? analysis.meshes : [],
    operations: analysis.ok ? analysis.operations : [],
    warnings: analysis.ok
      ? analysis.warnings.map((warning) => warning.message)
      : [],
    screenshots: analysis.screenshots,
    artifactDirectory,
    source,
  };
}

/**
 * Handles suite result in the suite flow.
 */
function suiteResult(input: {
  options: SuiteRunOptions;
  outDir: string;
  started: number;
  startedAt: string;
  loaded: Awaited<ReturnType<typeof loadSuiteManifest>>;
  cases: SuiteCaseResult[];
}): SuiteRunResult {
  const { options, outDir, started, startedAt, loaded, cases } = input;
  return {
    ok: cases.every((entry) => entry.status === 'passed'),
    title: loaded.manifest.title,
    description: loaded.manifest.description,
    suiteRoot: resolve(options.suiteRoot),
    outDir,
    startedAt,
    elapsedMs: Date.now() - started,
    coverage: loaded.coverage,
    manifestChecks: loaded.checks,
    cases,
    reportJsonPath: join(outDir, 'suite-report.json'),
    reportHtmlPath: join(outDir, 'suite-report.html'),
    reportPdfPath: join(outDir, 'suite-report.pdf'),
  };
}

/**
 * Handles assert manifest ready in the suite flow.
 */
function assertManifestReady(
  checks: { passed: boolean; name: string; detail: string }[],
  coverage: { missing: string[]; unknown: string[] },
): void {
  const failed = checks.filter((check) => !check.passed);
  if (coverage.missing.length > 0)
    failed.push({
      passed: false,
      name: 'Capability coverage',
      detail: `missing ${coverage.missing.join(', ')}`,
    });
  if (coverage.unknown.length > 0)
    failed.push({
      passed: false,
      name: 'Capability catalog',
      detail: `unknown ${coverage.unknown.join(', ')}`,
    });
  if (failed.length > 0) {
    throw new Error(
      `Language suite manifest is invalid:\n${failed.map((check) => `- ${check.name}: ${check.detail}`).join('\n')}`,
    );
  }
}
