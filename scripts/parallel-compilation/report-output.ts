/**
 * @author Aidan Boissonneault
 * @file report-output.ts
 * @purpose Provides report output behavior for the scripts parallel compilation in repository tooling.
 * @last-edited October 6, 2026
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Persists a full diagnostic report and optionally prints a redacted summary. */
export async function writeJsonReport(
  outPath: string,
  report: unknown,
  stdoutReport: unknown = report,
): Promise<void> {
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(stdoutReport, null, 2)}\n`);
}
