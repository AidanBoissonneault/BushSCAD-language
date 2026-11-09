/**
 * @author Aidan Boissonneault
 * @file request-fields.ts
 * @purpose Provides request fields behavior for the dto in cli package.
 * @last-edited October 6, 2026
 */

import type { CompilerRequestKind, DrawingOutputMode } from './types.js';

/**
 * String map limits, including entries, key, display value, and total.
 */
export type StringMapLimits = {
  entries: number;
  key: number;
  value: number;
  total: number;
  allowEmptyValues?: boolean;
};

/** Parses a bounded string map used for overlays and environment values. */
export function parseStringMap(
  value: unknown,
  label: string,
  limits: StringMapLimits,
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a string map.`);
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > limits.entries)
    throw new TypeError(`${label} has too many entries.`);
  const result = Object.create(null) as Record<string, string>;
  let total = 0;
  for (const [key, entry] of entries) {
    if (
      !boundedString(key, limits.key) ||
      !boundedString(entry, limits.value, limits.allowEmptyValues ?? false)
    ) {
      throw new TypeError(`${label} contains an invalid entry.`);
    }
    total += key.length + entry.length;
    if (total > limits.total)
      throw new TypeError(`${label} exceeds the total size limit.`);
    result[key] = entry;
  }
  return result;
}

/**
 * Parses optional index from the supplied source into the dto representation.
 */
export function parseOptionalIndex(
  value: unknown,
  label: string,
): number | undefined {
  if (value === undefined) return undefined;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > 10_000_000
  ) {
    throw new TypeError(`${label} must be a bounded non-negative integer.`);
  }
  return value as number;
}

/**
 * Parses suppressed indices from the supplied source into the dto representation.
 */
export function parseSuppressedIndices(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 10_000) {
    throw new TypeError(
      'Suppressed operation indices must be a bounded array.',
    );
  }
  return value.map(
    (entry) =>
      parseOptionalIndex(entry, 'Suppressed operation index') as number,
  );
}

/**
 * Parses entrypoint mode from the supplied source into the dto representation.
 */
export function parseEntrypointMode(
  value: unknown,
): 'workspace' | 'requested-file' {
  if (value === undefined || value === 'workspace') return 'workspace';
  if (value === 'requested-file') return value;
  throw new TypeError('Invalid compiler entrypoint mode.');
}

/**
 * Parses format from the supplied source into the dto representation.
 */
export function parseFormat(
  value: unknown,
  kind: CompilerRequestKind,
): 'step' | 'stl' | undefined {
  if (value !== undefined && value !== 'step' && value !== 'stl') {
    throw new TypeError('Invalid compiler export format.');
  }
  if (kind === 'export' && value === undefined)
    throw new TypeError('Compiler export format is required.');
  if (kind !== 'export' && value !== undefined)
    throw new TypeError('Compiler format is only valid for export.');
  return value as 'step' | 'stl' | undefined;
}

/**
 * Parses optional boolean from the supplied source into the dto representation.
 */
export function parseOptionalBoolean(
  value: unknown,
  label: string,
): boolean | undefined {
  if (value === undefined || typeof value === 'boolean') return value;
  throw new TypeError(`${label} must be a boolean.`);
}

/**
 * Parses engine from the supplied source into the dto representation.
 */
export function parseEngine(
  value: unknown,
): 'classic' | 'parallel' | undefined {
  if (value === undefined || value === 'classic' || value === 'parallel') {
    return value;
  }
  throw new TypeError('Invalid compiler engine.');
}

/** Restricts host-owned drawing writes to the drawing export request. */
export function parseDrawingOutputMode(
  value: unknown,
  kind: CompilerRequestKind,
): DrawingOutputMode | undefined {
  if (
    value !== undefined &&
    value !== 'write-source-paths' &&
    value !== 'return-content'
  )
    throw new TypeError('Invalid drawing output mode.');
  if (kind !== 'exportDrawings' && value !== undefined)
    throw new TypeError(
      'Drawing output mode is only valid for drawing export.',
    );
  return value as DrawingOutputMode | undefined;
}

/**
 * Handles assert preview controls in the dto flow.
 */
export function assertPreviewControls(
  kind: CompilerRequestKind,
  controls: readonly unknown[],
): void {
  if (kind !== 'preview' && controls.some((value) => value !== undefined)) {
    throw new TypeError(
      'Preview controls are only valid for preview requests.',
    );
  }
}

/**
 * Handles bounded string in the dto flow.
 */
function boundedString(
  value: unknown,
  maximum: number,
  allowEmpty = false,
): value is string {
  return (
    typeof value === 'string' &&
    (allowEmpty || value.length > 0) &&
    value.length <= maximum
  );
}
