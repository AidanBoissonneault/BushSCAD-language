/**
 * Binary mesh payload storage for completed build cache entries.
 *
 * Why: typed arrays are the large part of preview output. Writing array views
 * directly and reading them as views avoids retaining or copying another full
 * mesh payload in process memory.
 */

import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import type { MeshData } from '@bushscad/ir';
import type {
  CachedMesh,
  MeshBufferRange,
  MeshPayloadSummary,
} from './completed-build-cache-metadata.js';

/** Writes typed mesh arrays sequentially and records their disk offsets. */
export async function writeCompletedMeshPayload(
  path: string,
  meshes: readonly MeshData[],
): Promise<MeshPayloadSummary> {
  const file = await open(path, 'w');
  const hash = createHash('sha256');
  const cachedMeshes: CachedMesh[] = [];
  let position = 0;
  try {
    for (const mesh of meshes) {
      const { vertices, normals, indices, ...metadata } = mesh;
      const cachedMesh: CachedMesh = {
        metadata,
        vertices: meshBufferRange(
          position,
          vertices.length,
          vertices.BYTES_PER_ELEMENT,
        ),
        normals: emptyMeshBufferRange(),
        indices: emptyMeshBufferRange(),
      };
      position = await writeTypedArray(file, vertices, position, hash);
      cachedMesh.normals = meshBufferRange(
        position,
        normals.length,
        normals.BYTES_PER_ELEMENT,
      );
      position = await writeTypedArray(file, normals, position, hash);
      cachedMesh.indices = meshBufferRange(
        position,
        indices.length,
        indices.BYTES_PER_ELEMENT,
      );
      position = await writeTypedArray(file, indices, position, hash);
      cachedMeshes.push(cachedMesh);
    }
    await file.sync();
    return {
      byteLength: position,
      sha256: hash.digest('hex'),
      meshes: cachedMeshes,
    };
  } finally {
    await file.close();
  }
}

/** Restores zero-copy typed-array views after checking all payload bounds. */
export function restoreCompletedMeshes(
  payload: Buffer,
  cachedMeshes: readonly CachedMesh[],
): MeshData[] | undefined {
  const meshes = cachedMeshes.map((cached) => restoreMesh(payload, cached));
  return meshes.some((mesh) => !mesh) ? undefined : (meshes as MeshData[]);
}

/** Writes one array view without creating a second mesh-sized buffer. */
async function writeTypedArray(
  file: Awaited<ReturnType<typeof open>>,
  values: Float32Array | Uint32Array,
  position: number,
  hash: ReturnType<typeof createHash>,
): Promise<number> {
  const bytes = Buffer.from(
    values.buffer,
    values.byteOffset,
    values.byteLength,
  );
  hash.update(bytes);
  let written = 0;
  while (written < bytes.byteLength) {
    const result = await file.write(
      bytes,
      written,
      bytes.byteLength - written,
      position + written,
    );
    if (result.bytesWritten <= 0) throw new Error('Mesh cache write stalled.');
    written += result.bytesWritten;
  }
  return position + bytes.byteLength;
}

/** Creates a byte range for one three.js mesh typed array. */
function meshBufferRange(
  offset: number,
  length: number,
  bytesPerElement: number,
): MeshBufferRange {
  return { offset, length, byteLength: length * bytesPerElement };
}

/** Creates an empty range before its typed array is written. */
function emptyMeshBufferRange(): MeshBufferRange {
  return { offset: 0, byteLength: 0, length: 0 };
}

/** Restores one mesh after all of its array ranges pass bounds checks. */
function restoreMesh(
  payload: Buffer,
  cached: CachedMesh,
): MeshData | undefined {
  const vertices = restoreArray(payload, cached.vertices, Float32Array);
  const normals = restoreArray(payload, cached.normals, Float32Array);
  const indices = restoreArray(payload, cached.indices, Uint32Array);
  if (!vertices || !normals || !indices) return undefined;
  return { ...cached.metadata, vertices, normals, indices };
}

/** Creates a typed-array view over the single file read buffer. */
function restoreArray<TArray extends Float32Array | Uint32Array>(
  payload: Buffer,
  range: MeshBufferRange,
  ArrayType: {
    new (buffer: ArrayBufferLike, byteOffset: number, length: number): TArray;
  },
): TArray | undefined {
  if (!isSafeMeshBufferRange(range, payload.byteLength)) return undefined;
  const byteOffset = payload.byteOffset + range.offset;
  if (byteOffset % 4 !== 0) return undefined;
  try {
    return new ArrayType(payload.buffer, byteOffset, range.length);
  } catch {
    return undefined;
  }
}

/** Checks one array range before any typed-array constructor sees it. */
function isSafeMeshBufferRange(
  range: MeshBufferRange,
  payloadByteLength: number,
): boolean {
  return (
    Number.isSafeInteger(range.offset) &&
    Number.isSafeInteger(range.byteLength) &&
    Number.isSafeInteger(range.length) &&
    range.offset >= 0 &&
    range.length >= 0 &&
    range.offset % 4 === 0 &&
    range.byteLength === range.length * 4 &&
    range.offset + range.byteLength <= payloadByteLength
  );
}
