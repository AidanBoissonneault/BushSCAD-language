/**
 * Builds a stable identity for final parallel build output.
 *
 * Why: cached meshes are reusable only when every input that can affect worker
 * output is unchanged. Binary asset payloads are represented by content hashes
 * so the identity does not expand them into large JSON strings.
 */

import { createHash } from 'node:crypto';
import type { ParallelBuildTask } from './worker-protocol.js';

/** Exact build identity used by the disk-backed completed-output cache. */
export type CompletedBuildCacheIdentity = {
  digest: string;
  canonical: string;
};

/** Hashes all task inputs that can affect the completed worker output. */
export function completedBuildCacheIdentity(
  task: Omit<ParallelBuildTask, 'taskId'>,
): CompletedBuildCacheIdentity {
  const canonical = JSON.stringify({
    version: 1,
    partName: task.partName,
    autoColorOffset: task.autoColorOffset,
    program: task.program,
    assets: {
      fonts: task.assets.fonts.map((font) => ({
        name: font.name,
        sourcePath: font.sourcePath,
        fsPath: font.fsPath,
        dataLength: font.data.byteLength,
        dataSha256: checksum(font.data),
      })),
      shapes: task.assets.shapes.map((shape) => ({
        name: shape.name,
        sourcePath: shape.sourcePath,
        fsPath: shape.fsPath,
        format: shape.format,
        dataLength: shape.data.byteLength,
        dataSha256: checksum(shape.data),
      })),
    },
    drawingProgram: task.drawingProgram ?? null,
    preparedComponents: (task.preparedComponents ?? []).map(
      ({ brep, ...artifact }) => ({
        ...artifact,
        brepLength: brep.byteLength,
        brepSha256: checksum(brep),
      }),
    ),
    nativeBooleanPlan: task.nativeBooleanPlan ?? null,
    nativeBooleanConcurrencyLimit: task.nativeBooleanConcurrencyLimit ?? 1,
  });
  return {
    digest: checksumText(canonical),
    canonical,
  };
}

/** Computes a SHA-256 checksum over binary asset data without copying it. */
function checksum(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Computes the filesystem-safe identity for canonical build inputs. */
function checksumText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
