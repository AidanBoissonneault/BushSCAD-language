/**
 * Validated sidecar format for completed build cache entries.
 *
 * Why: binary mesh payloads need exact identity, length, checksum, and bounded
 * offsets before they can be trusted as compiler output.
 */

import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { MeshData } from '@bushscad/ir';
import type { ParallelBuildOutput } from './worker-protocol.js';

export const COMPLETED_BUILD_CACHE_FORMAT_VERSION = 1;

export type MeshBufferRange = {
  offset: number;
  byteLength: number;
  length: number;
};
export type CachedMesh = {
  metadata: Omit<MeshData, 'vertices' | 'normals' | 'indices'>;
  vertices: MeshBufferRange;
  normals: MeshBufferRange;
  indices: MeshBufferRange;
};
export type CachedBuildOutput = Pick<
  ParallelBuildOutput,
  | 'partName'
  | 'drawings'
  | 'interaction'
  | 'validations'
  | 'joints'
  | 'traceEvents'
>;
export type MeshPayloadSummary = {
  byteLength: number;
  sha256: string;
  meshes: CachedMesh[];
};
export type CompletedBuildMetadata = {
  version: number;
  digest: string;
  canonical: string;
  payloadByteLength: number;
  payloadSha256: string;
  output: CachedBuildOutput;
  meshes: CachedMesh[];
};
export type CompletedBuildSidecar = CompletedBuildMetadata & {
  metadataSha256: string;
};

/** Validates one parsed sidecar against its exact request identity. */
export function parseCompletedBuildMetadata(
  text: string,
  digest: string,
  canonical: string,
): CompletedBuildMetadata | undefined {
  const value = parseRecord(text);
  if (!value || !matchesBuildIdentity(value, digest, canonical))
    return undefined;
  if (!hasValidPayload(value)) return undefined;
  if (!isCachedBuildOutput(value['output'])) return undefined;
  if (!hasValidMeshEntries(value['meshes'])) return undefined;
  if (!hasValidSidecarChecksum(value)) return undefined;
  return value as unknown as CompletedBuildMetadata;
}

/** Restricts output keys to SHA-256 identities before they enter a path. */
export function isValidCompletedBuildDigest(digest: string): boolean {
  return /^[a-f0-9]{64}$/.test(digest);
}

/** Resolves the binary mesh payload path for one validated digest. */
export function completedBuildPayloadPath(
  directory: string,
  digest: string,
): string {
  return join(directory, `${digest}.mesh-cache`);
}

/** Resolves the JSON sidecar path for one validated digest. */
export function completedBuildMetadataPath(
  directory: string,
  digest: string,
): string {
  return join(directory, `${digest}.mesh-cache.json`);
}

/** Computes a checksum without copying the binary payload. */
export function completedBuildChecksum(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Checksums the JSON sidecar independently from its binary mesh payload. */
export function completedBuildTextChecksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Parses JSON while rejecting non-object and malformed sidecars. */
function parseRecord(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Confirms the version, digest, and canonical task string agree. */
function matchesBuildIdentity(
  record: Record<string, unknown>,
  digest: string,
  canonical: string,
): boolean {
  return (
    record['version'] === COMPLETED_BUILD_CACHE_FORMAT_VERSION &&
    record['digest'] === digest &&
    record['canonical'] === canonical
  );
}

/** Checks that the binary length and SHA-256 fields can be verified. */
function hasValidPayload(record: Record<string, unknown>): boolean {
  return (
    Number.isSafeInteger(record['payloadByteLength']) &&
    Number(record['payloadByteLength']) >= 0 &&
    typeof record['payloadSha256'] === 'string' &&
    /^[a-f0-9]{64}$/.test(record['payloadSha256'])
  );
}

/** Checks the cached semantic result before it is returned to compilation. */
function isCachedBuildOutput(value: unknown): value is CachedBuildOutput {
  return (
    isRecord(value) &&
    typeof value['partName'] === 'string' &&
    Array.isArray(value['drawings']) &&
    Array.isArray(value['validations']) &&
    Array.isArray(value['joints']) &&
    Array.isArray(value['traceEvents']) &&
    (value['interaction'] === undefined || isRecord(value['interaction']))
  );
}

/** Checks every mesh descriptor before offsets are used against the payload. */
function hasValidMeshEntries(value: unknown): value is CachedMesh[] {
  return Array.isArray(value) && value.every(isCachedMesh);
}

/** Checks mesh identity metadata and all three typed-array ranges. */
function isCachedMesh(value: unknown): value is CachedMesh {
  if (!isRecord(value) || !isRecord(value['metadata'])) return false;
  const metadata = value['metadata'];
  return (
    typeof metadata['partName'] === 'string' &&
    typeof metadata['color'] === 'string' &&
    isMeshBufferRange(value['vertices']) &&
    isMeshBufferRange(value['normals']) &&
    isMeshBufferRange(value['indices'])
  );
}

/** Checks integer offsets and element counts for one typed mesh buffer. */
function isMeshBufferRange(value: unknown): value is MeshBufferRange {
  if (!isRecord(value)) return false;
  const { offset, byteLength, length } = value;
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(byteLength) &&
    Number.isSafeInteger(length)
  );
}

/** Verifies that the sidecar's own JSON fields were not corrupted. */
function hasValidSidecarChecksum(record: Record<string, unknown>): boolean {
  const { metadataSha256, ...unsignedMetadata } = record;
  return (
    typeof metadataSha256 === 'string' &&
    completedBuildTextChecksum(JSON.stringify(unsignedMetadata)) ===
      metadataSha256
  );
}

/** Narrows parsed JSON objects before cache fields are accessed. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
