/**
 * @author Aidan Boissonneault
 * @file runExport.ts
 * @purpose Provides run export behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import { writeExportBuffers } from '@bushscad/compiler/node';
import type { CliOptions } from '../commands/args.js';
import { exportWithDefaultCompiler } from './default-compiler.js';
import { reportFailure } from './reportFailure.js';
import { writeDrawingFiles } from './writeDrawingFiles.js';

/** Runs geometry export and writes artifact plus drawing output. */
export async function runExport(options: CliOptions): Promise<number> {
  const result = await exportWithDefaultCompiler({
    filePath: options.filePath,
    env: options.env,
    format: options.format,
  });

  if (!result.ok) return reportFailure(result, options);

  const paths = writeExportBuffers(result.buffers, {
    sourceFile: options.filePath,
    format: options.format,
    out: options.out,
  });
  const writtenDrawings = writeDrawingFiles(result.drawings, options.filePath);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        env: result.env,
        elapsedMs: result.elapsedMs,
        artifacts: paths.map((path) => ({ path })),
        drawings: writtenDrawings,
      })}\n`,
    );
  } else {
    for (const path of paths) process.stdout.write(`Wrote ${path}\n`);
    for (const { path } of writtenDrawings)
      process.stdout.write(`Wrote ${path}\n`);
  }

  return 0;
}
