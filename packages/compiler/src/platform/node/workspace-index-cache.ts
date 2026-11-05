/**
 * @purpose Reuses a validated, bounded workspace graph in the Node compiler.
 */

import { createHash } from 'node:crypto';
import type { CompileError } from '@bushscad/ir';
import type {
  ProjectManifest,
  WorkspaceFile,
  WorkspaceIndex,
} from '../../workspace/types.js';

const MAX_RETAINED_BYTES = 4 * 1024 * 1024;

type SourceReader = (path: string) => string | null;

type WorkspaceIndexCacheEntry = {
  key: string;
  overlayFingerprint: string;
  manifestPath: string;
  manifestDigest: string;
  sourceDigests: Array<[string, string]>;
  index: WorkspaceIndex;
};

type WorkspaceIndexCacheLookup = {
  key: string;
  overlayFingerprint: string;
  manifestPath: string;
  readSource: SourceReader;
};

type WorkspaceIndexCacheStore = WorkspaceIndexCacheLookup & {
  index: WorkspaceIndex;
};

/** Keeps one small workspace graph and validates all source inputs on reuse. */
export class WorkspaceIndexCache {
  private entry: WorkspaceIndexCacheEntry | undefined;

  /** Returns a detached cached index only when every tracked input still matches. */
  get(input: WorkspaceIndexCacheLookup): WorkspaceIndex | undefined {
    const entry = this.entry;
    if (
      !entry ||
      entry.key !== input.key ||
      entry.overlayFingerprint !== input.overlayFingerprint ||
      hasDynamicIncludes(entry.index.manifest)
    ) {
      return undefined;
    }

    if (
      sourceDigest(input.readSource(entry.manifestPath)) !==
      entry.manifestDigest
    ) {
      this.entry = undefined;
      return undefined;
    }
    for (const [path, digest] of entry.sourceDigests) {
      if (sourceDigest(input.readSource(path)) !== digest) {
        this.entry = undefined;
        return undefined;
      }
    }
    return cloneWorkspaceIndex(entry.index);
  }

  /** Stores a defensive snapshot when its retained workspace graph fits the budget. */
  set(input: WorkspaceIndexCacheStore): void {
    if (
      hasDynamicIncludes(input.index.manifest) ||
      estimateRetainedBytes(input.index) > MAX_RETAINED_BYTES
    ) {
      this.entry = undefined;
      return;
    }

    this.entry = {
      key: input.key,
      overlayFingerprint: input.overlayFingerprint,
      manifestPath: input.manifestPath,
      manifestDigest: sourceDigest(input.readSource(input.manifestPath)),
      sourceDigests: Object.keys(input.index.files).map((path) => [
        path,
        sourceDigest(input.readSource(path)),
      ]),
      index: cloneWorkspaceIndex(input.index),
    };
  }
}

/** Hashes the normalized overlay map in stable path order for cache validation. */
export function fingerprintOverlays(overlays: Record<string, string>): string {
  const hash = createHash('sha256');
  const entries = Object.entries(overlays).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  for (const [path, source] of entries) {
    updateHashPart(hash, path);
    updateHashPart(hash, source);
  }
  return hash.digest('hex');
}

/** Detects include globs whose membership can change without editing a tracked file. */
function hasDynamicIncludes(manifest: ProjectManifest | null): boolean {
  return manifest?.include?.some((path) => path.includes('*')) ?? false;
}

/** Hashes source contents, including an explicit distinction for a missing file. */
function sourceDigest(source: string | null): string {
  const hash = createHash('sha256');
  if (source === null) {
    hash.update('missing');
  } else {
    hash.update('source');
    hash.update(source);
  }
  return hash.digest('hex');
}

/** Adds a length-prefixed string to a digest to avoid ambiguous concatenations. */
function updateHashPart(
  hash: ReturnType<typeof createHash>,
  value: string,
): void {
  hash.update(`${value.length}:`);
  hash.update(value);
}

/** Estimates retained graph size before keeping the single-entry cache. */
function estimateRetainedBytes(index: WorkspaceIndex): number {
  let bytes = 512;
  const addString = (value: string): void => {
    bytes += value.length * 2 + 32;
  };
  const addStrings = (values: readonly string[]): void => {
    bytes += values.length * 24;
    for (const value of values) addString(value);
  };

  addString(index.rootPath);
  addString(index.manifestPath ?? '');
  addString(index.defaultEntrypoint);
  addStrings(index.assets);
  if (index.manifest) addString(JSON.stringify(index.manifest));
  for (const entrypoint of index.entrypoints) {
    addString(entrypoint.name);
    addString(entrypoint.path);
  }
  for (const [path, file] of Object.entries(index.files)) {
    addString(path);
    addWorkspaceFileStrings(file, addStrings);
  }
  addRecordStrings(index.dependencies, addString, addStrings);
  addRecordStrings(index.dependents, addString, addStrings);
  addRecordStrings(index.entrypointDependencies, addString, addStrings);
  for (const error of index.errors) {
    addString(error.message);
    addString(error.span.file);
    bytes += 128;
  }
  return bytes;
}

/** Accounts for one workspace file's retained fields. */
function addWorkspaceFileStrings(
  file: WorkspaceFile,
  addStrings: (values: readonly string[]) => void,
): void {
  addStrings(file.imports);
  addStrings(file.assets);
  addStrings(file.dependencies);
  addStrings(file.dependents);
}

/** Accounts for keys and values in a workspace string-array record. */
function addRecordStrings(
  record: Record<string, string[]>,
  addString: (value: string) => void,
  addStrings: (values: readonly string[]) => void,
): void {
  for (const [key, values] of Object.entries(record)) {
    addString(key);
    addStrings(values);
  }
}

/** Copies all mutable index containers so callers cannot corrupt the cached graph. */
function cloneWorkspaceIndex(index: WorkspaceIndex): WorkspaceIndex {
  return {
    ...index,
    manifest: index.manifest ? cloneManifest(index.manifest) : null,
    entrypoints: index.entrypoints.map((entrypoint) => ({ ...entrypoint })),
    files: Object.fromEntries(
      Object.entries(index.files).map(([path, file]) => [
        path,
        {
          ...file,
          imports: [...file.imports],
          assets: [...file.assets],
          dependencies: [...file.dependencies],
          dependents: [...file.dependents],
        },
      ]),
    ),
    dependencies: cloneStringArrayRecord(index.dependencies),
    dependents: cloneStringArrayRecord(index.dependents),
    entrypointDependencies: cloneStringArrayRecord(
      index.entrypointDependencies,
    ),
    assets: [...index.assets],
    errors: index.errors.map(cloneCompileError),
  };
}

/** Clones each supported manifest container while preserving its declared form. */
function cloneManifest(manifest: ProjectManifest): ProjectManifest {
  const entrypoints = manifest.entrypoints;
  let clonedEntrypoints: ProjectManifest['entrypoints'];
  if (Array.isArray(entrypoints)) {
    clonedEntrypoints = entrypoints.every(
      (entry): entry is string => typeof entry === 'string',
    )
      ? [...entrypoints]
      : (entrypoints.map((entry) =>
          typeof entry === 'string' ? entry : { ...entry },
        ) as Exclude<
          NonNullable<ProjectManifest['entrypoints']>,
          Record<string, string>
        >);
  } else if (entrypoints) {
    clonedEntrypoints = { ...entrypoints };
  }
  return {
    ...manifest,
    ...(clonedEntrypoints ? { entrypoints: clonedEntrypoints } : {}),
    ...(manifest.include ? { include: [...manifest.include] } : {}),
    ...(manifest.assets ? { assets: [...manifest.assets] } : {}),
    ...(manifest.env ? { env: { ...manifest.env } } : {}),
    ...(manifest.export ? { export: { ...manifest.export } } : {}),
  };
}

/** Copies one compile error and its source span. */
function cloneCompileError(error: CompileError): CompileError {
  return { ...error, span: { ...error.span } };
}

/** Clones a record while preserving each dependency list's order. */
function cloneStringArrayRecord(
  record: Record<string, string[]>,
): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(record).map(([key, values]) => [key, [...values]]),
  );
}
