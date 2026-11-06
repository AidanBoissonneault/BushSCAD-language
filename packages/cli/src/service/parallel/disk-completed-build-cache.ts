/**
 * Disk storage for completed parallel worker outputs.
 *
 * Why: a cache hit must avoid the full worker reduction without leaving mesh
 * payloads resident between requests. Binary mesh data and its semantic
 * sidecar are written separately so reads can restore zero-copy typed arrays.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import type { ParallelBuildOutput } from './worker-protocol.js';
import type { CompletedBuildOutputCache } from './build-output-cache.js';
import {
  COMPLETED_BUILD_CACHE_FORMAT_VERSION,
  completedBuildChecksum,
  completedBuildMetadataPath,
  completedBuildPayloadPath,
  completedBuildTextChecksum,
  isValidCompletedBuildDigest,
  parseCompletedBuildMetadata,
  type CompletedBuildMetadata,
  type CompletedBuildSidecar,
} from './completed-build-cache-metadata.js';
import {
  restoreCompletedMeshes,
  writeCompletedMeshPayload,
} from './completed-build-mesh-payload.js';
import { SessionDiskCacheBudget } from './session-disk-cache-budget.js';

const LARGE_BUILD_DURATION_MS = 250;
const CACHE_WRITE_INTERVAL_MS = 10_000;
let lastSuccessfulWriteAt = 0;
let pendingWrites: Promise<void> = Promise.resolve();

/** Reads and writes verified build results without keeping payloads in a map. */
export class DiskCompletedBuildCache implements CompletedBuildOutputCache {
  constructor(
    private readonly directory: string,
    private readonly budget?: SessionDiskCacheBudget,
  ) {}

  /** Loads one output only when its task identity and binary payload verify. */
  async get(
    digest: string,
    canonical: string,
  ): Promise<ParallelBuildOutput | undefined> {
    if (!isValidCompletedBuildDigest(digest) || canonical.length === 0) {
      return undefined;
    }
    try {
      const metadata = parseCompletedBuildMetadata(
        await readFile(
          completedBuildMetadataPath(this.directory, digest),
          'utf8',
        ),
        digest,
        canonical,
      );
      if (!metadata) return undefined;
      const payload = await readFile(
        completedBuildPayloadPath(this.directory, digest),
      );
      if (
        payload.byteLength !== metadata.payloadByteLength ||
        completedBuildChecksum(payload) !== metadata.payloadSha256
      ) {
        return undefined;
      }
      const meshes = restoreCompletedMeshes(payload, metadata.meshes);
      if (!meshes) return undefined;
      if (this.budget) {
        await this.budget
          .touch(completedBuildCacheEntry(digest))
          .catch(() => undefined);
      }
      return {
        taskId: 0,
        partName: metadata.output.partName,
        sourceIndex: 0,
        meshes,
        drawings: metadata.output.drawings,
        ...(metadata.output.interaction
          ? { interaction: metadata.output.interaction }
          : {}),
        validations: metadata.output.validations,
        joints: metadata.output.joints,
        traceEvents: metadata.output.traceEvents,
        elapsedMs: 0,
        workerCpuMs: 0,
        workerRssBytes: 0,
      };
    } catch {
      return undefined;
    }
  }

  /** Persists a costly result or the first result after the idle-write interval. */
  async put(
    digest: string,
    canonical: string,
    output: ParallelBuildOutput,
  ): Promise<void> {
    if (
      !isValidCompletedBuildDigest(digest) ||
      canonical.length === 0 ||
      output.meshes.length === 0
    ) {
      return;
    }
    const pending = pendingWrites.then(() =>
      this.writeIfAllowed(digest, canonical, output),
    );
    pendingWrites = pending.catch(() => undefined);
    await pending;
  }

  /** Publishes binary buffers first and the identity sidecar last. */
  private async writeIfAllowed(
    digest: string,
    canonical: string,
    output: ParallelBuildOutput,
  ): Promise<void> {
    const now = Date.now();
    if (
      output.elapsedMs < LARGE_BUILD_DURATION_MS &&
      now - lastSuccessfulWriteAt < CACHE_WRITE_INTERVAL_MS
    ) {
      return;
    }

    await mkdir(this.directory, { recursive: true });
    const suffix = `${process.pid}-${randomUUID()}`;
    const dataPath = completedBuildPayloadPath(this.directory, digest);
    const metadataFilePath = completedBuildMetadataPath(this.directory, digest);
    const dataTemporaryPath = `${dataPath}.${suffix}.tmp`;
    const metadataTemporaryPath = `${metadataFilePath}.${suffix}.tmp`;
    const writeEntry = async (): Promise<number> => {
      try {
        const payload = await writeCompletedMeshPayload(
          dataTemporaryPath,
          output.meshes,
        );
        const metadata: CompletedBuildMetadata = {
          version: COMPLETED_BUILD_CACHE_FORMAT_VERSION,
          digest,
          canonical,
          payloadByteLength: payload.byteLength,
          payloadSha256: payload.sha256,
          output: {
            partName: output.partName,
            drawings: output.drawings,
            ...(output.interaction ? { interaction: output.interaction } : {}),
            validations: output.validations,
            joints: output.joints,
            traceEvents: output.traceEvents,
          },
          meshes: payload.meshes,
        };
        await rm(dataPath, { force: true });
        await rename(dataTemporaryPath, dataPath);
        const metadataText = JSON.stringify(metadata);
        const sidecar: CompletedBuildSidecar = {
          ...metadata,
          metadataSha256: completedBuildTextChecksum(metadataText),
        };
        await writeFile(metadataTemporaryPath, JSON.stringify(sidecar));
        await rm(metadataFilePath, { force: true });
        await rename(metadataTemporaryPath, metadataFilePath);
        lastSuccessfulWriteAt = now;
        const [dataStat, metadataStat] = await Promise.all([
          stat(dataPath),
          stat(metadataFilePath),
        ]);
        return dataStat.size + metadataStat.size;
      } finally {
        await Promise.all([
          rm(dataTemporaryPath, { force: true }),
          rm(metadataTemporaryPath, { force: true }),
        ]);
      }
    };
    if (this.budget) {
      await this.budget.store(completedBuildCacheEntry(digest), writeEntry);
      return;
    }
    await writeEntry();
  }
}

/** Identifies one completed output with the lowest cache retention priority. */
function completedBuildCacheEntry(digest: string) {
  return {
    key: `completed-build:${digest}`,
    dataFileName: `${digest}.mesh-cache`,
    metadataFileName: `${digest}.mesh-cache.json`,
    priority: 'completed-build' as const,
  };
}
