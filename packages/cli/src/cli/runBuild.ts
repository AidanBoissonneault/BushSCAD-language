/**
 * @author Aidan Boissonneault
 * @file runBuild.ts
 * @purpose Provides run build behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import type { CliOptions } from '../commands/arguments/types.js';
import { previewWithDefaultCompiler } from './default-compiler.js';
import { reportFailure } from './reportFailure.js';
import { writeDrawingFiles } from './writeDrawingFiles.js';

/** Runs preview/build validation and writes assertion plus drawing output. */
export async function runBuild(options: CliOptions): Promise<number> {
  const result = await previewWithDefaultCompiler({
    filePath: options.filePath,
    env: options.env,
  });

  if (!result.ok) return reportFailure(result, options);

  const failed = result.validations.filter((v) => !v.passed);
  const hasErrors = failed.some((v) => v.severity === 'error');
  const writtenDrawings = writeDrawingFiles(result.drawings, options.filePath);

  if (options.json) {
    writeBuildJson(result, writtenDrawings, hasErrors);
  } else {
    writeBuildText(options, result, failed, writtenDrawings);
  }

  return hasErrors ? 1 : 0;
}

/**
 * Writes build json to the configured destination.
 */
function writeBuildJson(
  result: Awaited<ReturnType<typeof previewWithDefaultCompiler>> & { ok: true },
  writtenDrawings: ReturnType<typeof writeDrawingFiles>,
  hasErrors: boolean,
): void {
  process.stdout.write(
    `${JSON.stringify({
      ok: !hasErrors,
      validations: result.validations,
      joints: result.joints,
      drawings: writtenDrawings,
      env: result.env,
      elapsedMs: result.elapsedMs,
    })}\n`,
  );
}

/**
 * Writes build text to the configured destination.
 */
export function writeBuildText(
  options: CliOptions,
  result: Awaited<ReturnType<typeof previewWithDefaultCompiler>> & { ok: true },
  failed: (Awaited<ReturnType<typeof previewWithDefaultCompiler>> & {
    ok: true;
  })['validations'],
  writtenDrawings: ReturnType<typeof writeDrawingFiles>,
): void {
  if (failed.length === 0) {
    process.stdout.write(
      `OK ${options.filePath} â€” all assertions passed (${result.elapsedMs.toFixed(0)}ms)\n`,
    );
  } else {
    for (const v of failed) {
      const icon = v.severity === 'warning' ? 'WARN' : 'FAIL';
      process.stdout.write(
        `${icon}  ${v.span.file}:${v.span.line}:${v.span.col}  ${v.message}\n`,
      );
    }
  }
  for (const { path } of writtenDrawings) {
    process.stdout.write(`Wrote ${path}\n`);
  }
}
