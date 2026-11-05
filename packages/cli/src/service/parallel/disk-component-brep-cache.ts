/**
 * @author Aidan Boissonneault
 * @file disk-component-brep-cache.ts
 * @purpose Stores lossless prepared component payloads for one compiler service session.
 */

import { createHash, randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PreparedComponentBrepCache } from '@bushscad/compiler';

const CACHE_FORMAT_VERSION = 1;
const LARGE_COMPONENT_DURATION_MS = 250;
const CACHE_WRITE_INTERVAL_MS = 10_000;
let lastSuccessfulWriteAt = 0;
let pendingWrites: Promise<void> = Promise.resolve();

type ComponentCacheMetadata = {
  version: number;
  format: 'occt-brep-v1';
  recipeDigest: string;
  recipeCanonicalSha256: string;
  byteLength: number;
  sha256: string;
};

/** Reads and writes recipe-keyed BRep payloads without retaining them in memory. */
export class DiskComponentBrepCache implements PreparedComponentBrepCache {
  constructor(private readonly directory: string) {}

  /** Loads and verifies one disk payload on demand. */
  async get(
    recipeDigest: string,
    recipeCanonical: string,
  ): Promise<Uint8Array | undefined> {
    if (!validRecipeDigest(recipeDigest) || recipeCanonical.length === 0)
      return undefined;
    const recipeCanonicalSha256 = checksumText(recipeCanonical);
    try {
      const metadata = parseMetadata(
        await readFile(
          metadataPath(this.directory, recipeDigest, recipeCanonicalSha256),
          'utf8',
        ),
        recipeDigest,
        recipeCanonicalSha256,
      );
      if (!metadata) return undefined;
      const brep = await readFile(
        brepPath(this.directory, recipeDigest, recipeCanonicalSha256),
      );
      if (
        brep.byteLength !== metadata.byteLength ||
        checksum(brep) !== metadata.sha256
      ) {
        return undefined;
      }
      return brep;
    } catch {
      return undefined;
    }
  }

  /** Writes a component after a costly operation or the idle-write interval. */
  async put(
    recipeDigest: string,
    recipeCanonical: string,
    brep: Uint8Array,
    operationDurationMs: number,
  ): Promise<void> {
    if (
      !validRecipeDigest(recipeDigest) ||
      recipeCanonical.length === 0 ||
      brep.byteLength === 0
    ) {
      return;
    }
    const pending = pendingWrites.then(() =>
      this.writeIfAllowed(
        recipeDigest,
        recipeCanonical,
        brep,
        operationDurationMs,
      ),
    );
    pendingWrites = pending.catch(() => undefined);
    await pending;
  }

  /** Applies the shared write cadence and publishes one integrity-checked entry. */
  private async writeIfAllowed(
    recipeDigest: string,
    recipeCanonical: string,
    brep: Uint8Array,
    operationDurationMs: number,
  ): Promise<void> {
    const now = Date.now();
    if (
      operationDurationMs < LARGE_COMPONENT_DURATION_MS &&
      now - lastSuccessfulWriteAt < CACHE_WRITE_INTERVAL_MS
    ) {
      return;
    }

    const recipeCanonicalSha256 = checksumText(recipeCanonical);
    const metadata: ComponentCacheMetadata = {
      version: CACHE_FORMAT_VERSION,
      format: 'occt-brep-v1',
      recipeDigest,
      recipeCanonicalSha256,
      byteLength: brep.byteLength,
      sha256: checksum(brep),
    };
    const suffix = `${process.pid}-${randomUUID()}`;
    const dataPath = brepPath(
      this.directory,
      recipeDigest,
      recipeCanonicalSha256,
    );
    const metadataFilePath = metadataPath(
      this.directory,
      recipeDigest,
      recipeCanonicalSha256,
    );
    const dataTemporaryPath = `${dataPath}.${suffix}.tmp`;
    const metadataTemporaryPath = `${metadataFilePath}.${suffix}.tmp`;
    try {
      await writeFile(dataTemporaryPath, brep);
      await rename(dataTemporaryPath, dataPath);
      await writeFile(metadataTemporaryPath, JSON.stringify(metadata));
      await rename(metadataTemporaryPath, metadataFilePath);
      lastSuccessfulWriteAt = now;
    } finally {
      await Promise.all([
        rm(dataTemporaryPath, { force: true }),
        rm(metadataTemporaryPath, { force: true }),
      ]);
    }
  }
}

/** Restricts cache filenames to the compiler's deterministic hex digests. */
function validRecipeDigest(value: string): boolean {
  return /^[a-f0-9]{16}$/.test(value);
}

/** Resolves the sidecar paths only after the digest has been validated. */
function brepPath(
  directory: string,
  digest: string,
  canonicalHash: string,
): string {
  return join(directory, `${digest}-${canonicalHash}.brep`);
}

/** Resolves the metadata path only after the digest has been validated. */
function metadataPath(
  directory: string,
  digest: string,
  canonicalHash: string,
): string {
  return join(directory, `${digest}-${canonicalHash}.json`);
}

/** Decodes cache metadata and rejects entries from another format or recipe. */
function parseMetadata(
  text: string,
  recipeDigest: string,
  recipeCanonicalSha256: string,
): ComponentCacheMetadata | undefined {
  const value = parseJson(text);
  if (!isRecord(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    !metadataMatchesRecipe(record, recipeDigest, recipeCanonicalSha256) ||
    !metadataHasValidPayload(record)
  ) {
    return undefined;
  }
  return record as ComponentCacheMetadata;
}

/** Parses JSON without allowing malformed or truncated metadata to escape. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Narrows parsed JSON objects before any metadata property is read. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/** Confirms a metadata sidecar belongs to the expected exact graph recipe. */
function metadataMatchesRecipe(
  record: Record<string, unknown>,
  recipeDigest: string,
  recipeCanonicalSha256: string,
): boolean {
  return (
    record['version'] === CACHE_FORMAT_VERSION &&
    record['format'] === 'occt-brep-v1' &&
    record['recipeDigest'] === recipeDigest &&
    record['recipeCanonicalSha256'] === recipeCanonicalSha256
  );
}

/** Validates byte length and checksum fields before loading the BRep payload. */
function metadataHasValidPayload(record: Record<string, unknown>): boolean {
  return (
    Number.isSafeInteger(record['byteLength']) &&
    Number(record['byteLength']) > 0 &&
    typeof record['sha256'] === 'string' &&
    /^[a-f0-9]{64}$/.test(record['sha256'])
  );
}

/** Computes a strong canonical-recipe identity for persisted cache filenames. */
function checksumText(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Computes an integrity checksum without copying the BRep payload. */
function checksum(brep: Uint8Array): string {
  return createHash('sha256').update(brep).digest('hex');
}
