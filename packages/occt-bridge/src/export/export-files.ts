/**
 * @author Aidan Boissonneault
 * @file export-files.ts
 * @purpose Exports files for the export in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';

/**
 * Reads export file from the supplied source.
 */
export function readExportFile(
  oc: OC,
  fname: string,
  name: string,
  progress: { delete(): void },
  writer: { delete(): void },
): { name: string; data: ArrayBuffer } {
  progress.delete();
  const bytes: Uint8Array = oc.FS.readFile(fname, { encoding: 'binary' });
  oc.FS.unlink(fname);
  writer.delete();
  return { name, data: bytes.slice().buffer };
}
