/**
 * @author Aidan Boissonneault
 * @file stable-serialization.ts
 * @purpose Provides stable serialization behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

/** Serializes JSON-compatible data with recursively sorted object keys. */
export function stableStringify(value: unknown, indentation = 0): string {
  return JSON.stringify(canonicalValue(value), null, indentation);
}

/** Produces a deterministic non-secret digest for graph IDs and redacted keys. */
export function stableDigest(value: unknown): string {
  const text = typeof value === 'string' ? value : stableStringify(value);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `${hex(first)}${hex(second)}`;
}

/**
 * Handles canonical value in the pipeline parallel compilation flow.
 */
function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== 'object') return value;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, child]) => child !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(
    entries.map(([key, child]) => [key, canonicalValue(child)]),
  );
}

/**
 * Handles hex in the pipeline parallel compilation flow.
 */
function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}
