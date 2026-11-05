/** Measures repeated IR compilation time, process memory, and output stability. */

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { compileFileToIr } from '@bushscad/compiler/node';

type BenchmarkSample = {
  wallMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  heapBeforeBytes: number;
  heapAfterBytes: number;
  rssBeforeBytes: number;
  rssAfterBytes: number;
  maxRssBytes: number;
  operationCount: number;
  semanticHash: string;
};

type BenchmarkOptions = {
  filePath: string;
  runs: number;
  outPath: string;
  semanticOutPath?: string;
};
type CompileResult = ReturnType<typeof compileFileToIr>;
type SuccessfulCompileResult = Extract<CompileResult, { ok: true }>;
type RawCompileMeasurement = {
  result: CompileResult;
  startedAt: number;
  cpu: ReturnType<typeof process.cpuUsage>;
  memoryBefore: ReturnType<typeof process.memoryUsage>;
  memoryAfter: ReturnType<typeof process.memoryUsage>;
};

/** Runs repeated compiles so cold and warm compiler costs can be compared. */
async function run(): Promise<void> {
  const options = readOptions();
  const samples: BenchmarkSample[] = [];

  for (let index = 0; index < options.runs; index++) {
    samples.push(await measureCompile(options, index === 0));
  }

  const report = createReport(options, samples);
  await writeJsonFile(options.outPath, report);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

/** Parses benchmark inputs once so each measured iteration stays focused. */
function readOptions(): BenchmarkOptions {
  const semanticOutArg = process.argv.indexOf('--semantic-out');
  const semanticOutValue =
    semanticOutArg >= 0 ? process.argv[semanticOutArg + 1] : undefined;
  return {
    filePath: resolve(
      readArg('--file', 'examples/test_suite/09_assembly_patterns.bscd'),
    ),
    runs: positiveInteger(readArg('--runs', '5')),
    outPath: resolve(
      readArg(
        '--out',
        '.bushscad-analysis/compiler-runtime/compile-benchmark.json',
      ),
    ),
    ...(semanticOutValue ? { semanticOutPath: resolve(semanticOutValue) } : {}),
  };
}

/** Measures one compile and records its output fingerprint and memory use. */
async function measureCompile(
  options: BenchmarkOptions,
  writeSemanticOutput: boolean,
): Promise<BenchmarkSample> {
  const measurement = compileOnce(options.filePath);
  const result = requireSuccessfulCompile(measurement.result, options.filePath);
  const { elapsedMs: _elapsedMs, ...semanticResult } = result;
  const semanticJson = stableSemanticJson(semanticResult);
  await writeFirstSemanticOutput(
    options.semanticOutPath,
    semanticJson,
    writeSemanticOutput,
  );
  return createSample(measurement, result, semanticJson);
}

/** Captures time and memory immediately around the compiler call. */
function compileOnce(filePath: string): RawCompileMeasurement {
  const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
  gc?.();
  const startedAt = performance.now();
  const startedCpu = process.cpuUsage();
  const memoryBefore = process.memoryUsage();
  const result = compileFileToIr({ filePath });
  const memoryAfter = process.memoryUsage();
  const cpu = process.cpuUsage(startedCpu);
  return { result, startedAt, cpu, memoryBefore, memoryAfter };
}

/** Throws with the compiler diagnostic when a sample fails to compile. */
function requireSuccessfulCompile(
  result: CompileResult,
  filePath: string,
): SuccessfulCompileResult {
  if (result.ok) return result;
  throw new Error(result.errors[0]?.message ?? `Compile failed: ${filePath}`);
}

/** Writes the optional semantic sample only for the first benchmark iteration. */
async function writeFirstSemanticOutput(
  path: string | undefined,
  content: string,
  shouldWrite: boolean,
): Promise<void> {
  if (!shouldWrite || !path) return;
  await writeJsonText(path, content);
}

/** Combines compile timings and semantic output into the report sample. */
function createSample(
  measurement: RawCompileMeasurement,
  result: SuccessfulCompileResult,
  semanticJson: string,
): BenchmarkSample {
  return {
    wallMs: performance.now() - measurement.startedAt,
    cpuUserMs: measurement.cpu.user / 1_000,
    cpuSystemMs: measurement.cpu.system / 1_000,
    heapBeforeBytes: measurement.memoryBefore.heapUsed,
    heapAfterBytes: measurement.memoryAfter.heapUsed,
    rssBeforeBytes: measurement.memoryBefore.rss,
    rssAfterBytes: measurement.memoryAfter.rss,
    maxRssBytes: process.resourceUsage().maxRSS * 1_024,
    operationCount: result.program.ops.length,
    semanticHash: createHash('sha256').update(semanticJson).digest('hex'),
  };
}

/** Produces the stable report envelope shared by all benchmark workloads. */
function createReport(
  options: BenchmarkOptions,
  samples: BenchmarkSample[],
): Record<string, unknown> {
  return {
    generatedAt: new Date().toISOString(),
    node: process.version,
    filePath: options.filePath,
    runs: options.runs,
    samples,
  };
}

/** Writes JSON under the requested output path, creating parent directories. */
async function writeJsonFile(path: string, value: unknown): Promise<void> {
  await writeJsonText(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Writes UTF-8 text under the requested path after creating its directory. */
async function writeJsonText(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${content.replace(/\n$/, '')}\n`, 'utf8');
}

/** Removes checkout-specific paths and sketch IDs from cross-worktree comparisons. */
function stableSemanticJson(value: unknown): string {
  const json = JSON.stringify(value, (key, item: unknown) => {
    if (
      key === 'id' &&
      typeof item === 'string' &&
      item.startsWith('sketch-instance|')
    ) {
      const parts = item.split('|');
      parts[parts.length - 1] = '$ID';
      return parts.join('|');
    }
    return item;
  });
  const root = process.cwd();
  const escapedRoot = root.replaceAll('\\', '\\\\');
  const slashRoot = root.replaceAll('\\', '/');
  const encodedSlashRoot = encodeURIComponent(slashRoot);
  const doubleEncodedSlashRoot = encodeURIComponent(encodedSlashRoot);
  return json
    .replaceAll(escapedRoot, '$ROOT')
    .replaceAll(slashRoot, '$ROOT')
    .replaceAll(encodedSlashRoot, '$ROOT')
    .replaceAll(doubleEncodedSlashRoot, '$ROOT');
}

/** Reads a named CLI option or returns its fallback. */
function readArg(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

/** Parses a positive integer CLI value. */
function positiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer, received '${value}'.`);
  }
  return parsed;
}

void run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
  );
  process.exitCode = 1;
});
