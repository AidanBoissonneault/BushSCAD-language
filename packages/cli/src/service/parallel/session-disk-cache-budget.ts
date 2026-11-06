/** Shared capacity and retention policy for one VS Code compiler session cache. */

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const CACHE_INDEX_VERSION = 1;
const CACHE_INDEX_FILE = 'session-cache-index.json';

export type SessionCacheRetentionPriority =
  'completed-build' | 'automatic' | 'manual';

export type SessionCacheEntryIdentity = Readonly<{
  key: string;
  dataFileName: string;
  metadataFileName: string;
  priority: SessionCacheRetentionPriority;
}>;

type SessionCacheEntry = SessionCacheEntryIdentity & {
  sizeBytes: number;
  lastUsedAt: number;
  lastUsedOrder: number;
};

/** Applies one combined byte budget and LRU policy to session cache artifacts. */
export class SessionDiskCacheBudget {
  private entries: Map<string, SessionCacheEntry> | undefined;
  private nextUseOrder = 0;
  private serialized: Promise<void> = Promise.resolve();
  private maximumBytes: number;

  constructor(
    private readonly directory: string,
    maximumBytes: number,
  ) {
    this.maximumBytes = normalizeLimit(maximumBytes);
  }

  /** Updates the active session limit and evicts entries if it was reduced. */
  async setMaximumBytes(maximumBytes: number): Promise<void> {
    await this.serialize(async () => {
      this.maximumBytes = normalizeLimit(maximumBytes);
      await this.loadEntries();
      await this.evictOverLimit();
      await this.saveEntries();
    });
  }

  /** Refreshes recency and applies the current breakpoint priority on a cache hit. */
  async touch(entry: SessionCacheEntryIdentity): Promise<void> {
    await this.serialize(async () => {
      const entries = await this.loadEntries();
      const stored = entries.get(entry.key);
      const files = stored ?? (await this.entryFromFiles(entry));
      if (!files) return;
      entries.set(entry.key, this.markUsed({ ...files, ...entry }));
      await this.evictOverLimit();
      await this.saveEntries();
    });
  }

  /** Stores one completed entry, evicting lower priority and older entries first. */
  async store(
    entry: SessionCacheEntryIdentity,
    write: () => Promise<number>,
    sizeBytesHint?: number,
  ): Promise<boolean> {
    return this.serialize(async () => {
      const entries = await this.loadEntries();
      if (sizeBytesHint !== undefined && sizeBytesHint > this.maximumBytes) {
        return false;
      }
      const sizeBytes = await write();
      if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) {
        throw new TypeError('Cache entry size must be a non-negative integer.');
      }
      if (sizeBytes > this.maximumBytes) {
        await this.removeFiles(entry);
        entries.delete(entry.key);
        await this.saveEntries();
        return false;
      }
      entries.set(
        entry.key,
        this.markUsed({ ...entry, sizeBytes, lastUsedAt: 0, lastUsedOrder: 0 }),
      );
      await this.evictOverLimit();
      await this.saveEntries();
      return entries.has(entry.key);
    });
  }

  /** Serializes index updates and cache writes across both disk cache adapters. */
  private async serialize<T>(operation: () => Promise<T>): Promise<T> {
    const current = this.serialized.then(operation);
    this.serialized = current.then(
      () => undefined,
      () => undefined,
    );
    return current;
  }

  /** Loads and validates the persisted index once for this compiler process. */
  private async loadEntries(): Promise<Map<string, SessionCacheEntry>> {
    if (this.entries) return this.entries;
    const entries = new Map<string, SessionCacheEntry>();
    try {
      const parsed: unknown = JSON.parse(
        await readFile(join(this.directory, CACHE_INDEX_FILE), 'utf8'),
      );
      if (isRecord(parsed) && parsed['version'] === CACHE_INDEX_VERSION) {
        const candidates = Array.isArray(parsed['entries'])
          ? parsed['entries']
          : [];
        for (const candidate of candidates) {
          const entry = await validateStoredEntry(candidate, this.directory);
          if (!entry) continue;
          entries.set(entry.key, entry);
          this.nextUseOrder = Math.max(this.nextUseOrder, entry.lastUsedOrder);
        }
      }
    } catch {
      // A missing or corrupt index makes old entries cold; compilation remains available.
    }
    this.entries = entries;
    return entries;
  }

  /** Registers entries missing from the index after verifying both stored files exist. */
  private async entryFromFiles(
    entry: SessionCacheEntryIdentity,
  ): Promise<SessionCacheEntry | undefined> {
    if (!validEntryIdentity(entry)) return undefined;
    try {
      const [data, metadata] = await Promise.all([
        stat(join(this.directory, entry.dataFileName)),
        stat(join(this.directory, entry.metadataFileName)),
      ]);
      return {
        ...entry,
        sizeBytes: data.size + metadata.size,
        lastUsedAt: 0,
        lastUsedOrder: 0,
      };
    } catch {
      return undefined;
    }
  }

  /** Keeps the newest entries within the configured combined disk limit. */
  private async evictOverLimit(): Promise<void> {
    const entries = await this.loadEntries();
    let usedBytes = [...entries.values()].reduce(
      (total, entry) => total + entry.sizeBytes,
      0,
    );
    const oldestFirst = [...entries.values()].sort((left, right) => {
      const priorityDelta =
        priorityRank(left.priority) - priorityRank(right.priority);
      return (
        priorityDelta ||
        left.lastUsedAt - right.lastUsedAt ||
        left.lastUsedOrder - right.lastUsedOrder
      );
    });
    for (const entry of oldestFirst) {
      if (usedBytes <= this.maximumBytes) break;
      await this.removeFiles(entry);
      entries.delete(entry.key);
      usedBytes -= entry.sizeBytes;
    }
  }

  /** Atomically replaces the index after cache entry changes are complete. */
  private async saveEntries(): Promise<void> {
    const entries = await this.loadEntries();
    await mkdir(this.directory, { recursive: true });
    const indexPath = join(this.directory, CACHE_INDEX_FILE);
    const temporaryPath = `${indexPath}.${process.pid}-${randomUUID()}.tmp`;
    try {
      await writeFile(
        temporaryPath,
        JSON.stringify({
          version: CACHE_INDEX_VERSION,
          entries: [...entries.values()],
        }),
        'utf8',
      );
      await rm(indexPath, { force: true });
      await rename(temporaryPath, indexPath);
    } finally {
      await rm(temporaryPath, { force: true });
    }
  }

  /** Removes a cache pair without touching the cache index. */
  private async removeFiles(entry: SessionCacheEntryIdentity): Promise<void> {
    if (!validEntryIdentity(entry)) return;
    await Promise.all([
      rm(join(this.directory, entry.dataFileName), { force: true }),
      rm(join(this.directory, entry.metadataFileName), { force: true }),
    ]);
  }

  /** Adds monotonic ordering so entries touched in the same millisecond remain ordered. */
  private markUsed(entry: SessionCacheEntry): SessionCacheEntry {
    return {
      ...entry,
      lastUsedAt: Date.now(),
      lastUsedOrder: ++this.nextUseOrder,
    };
  }
}

/** Parses one persisted record and refreshes its size from the actual files. */
async function validateStoredEntry(
  value: unknown,
  directory: string,
): Promise<SessionCacheEntry | undefined> {
  if (
    !isRecord(value) ||
    typeof value['key'] !== 'string' ||
    !Number.isSafeInteger(value['sizeBytes']) ||
    Number(value['sizeBytes']) < 0 ||
    !Number.isSafeInteger(value['lastUsedAt']) ||
    !Number.isSafeInteger(value['lastUsedOrder'])
  ) {
    return undefined;
  }
  const entry = {
    key: value['key'],
    dataFileName: value['dataFileName'],
    metadataFileName: value['metadataFileName'],
    priority: value['priority'],
  };
  if (!validEntryIdentity(entry)) return undefined;
  try {
    const [data, metadata] = await Promise.all([
      stat(join(directory, entry.dataFileName)),
      stat(join(directory, entry.metadataFileName)),
    ]);
    return {
      ...entry,
      sizeBytes: data.size + metadata.size,
      lastUsedAt: Number(value['lastUsedAt']),
      lastUsedOrder: Number(value['lastUsedOrder']),
    };
  } catch {
    return undefined;
  }
}

/** Rejects index-controlled paths that could escape the session cache directory. */
function validEntryIdentity(
  value: Record<string, unknown> | SessionCacheEntryIdentity,
): value is SessionCacheEntryIdentity {
  return (
    typeof value['key'] === 'string' &&
    typeof value['dataFileName'] === 'string' &&
    safeCacheFileName(value['dataFileName']) &&
    typeof value['metadataFileName'] === 'string' &&
    safeCacheFileName(value['metadataFileName']) &&
    (value['priority'] === 'manual' ||
      value['priority'] === 'automatic' ||
      value['priority'] === 'completed-build')
  );
}

/** Accepts only simple file names generated by the cache adapters. */
function safeCacheFileName(value: string): boolean {
  return (
    basename(value) === value &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.startsWith('.') &&
    value !== CACHE_INDEX_FILE
  );
}

/** Orders retention tiers while leaving recency to order entries within each tier. */
function priorityRank(priority: SessionCacheRetentionPriority): number {
  if (priority === 'manual') return 2;
  if (priority === 'automatic') return 1;
  return 0;
}

/** Restricts cache capacity to a finite, non-negative integer byte count. */
function normalizeLimit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Narrows parsed JSON objects before index fields are read. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
