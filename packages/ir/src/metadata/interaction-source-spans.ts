/**
 * @author Aidan Boissonneault
 * @file interaction-source-spans.ts
 * @purpose Provides interaction source spans behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '../shared/ir-core.js';
import type { InteractionSourceLink } from './interaction-source-links.js';

/** Tests a normalized file position against a half-open compiler source span. */
export function positionInInteractionSpan(
  file: string,
  line: number,
  col: number,
  span: SourceSpan,
): boolean {
  if (!sameInteractionFile(file, span.file)) return false;
  const endLine = span.endLine ?? span.line;
  const endCol = span.endCol ?? span.col;
  return (
    compare(line, col, span.line, span.col) >= 0 &&
    compare(line, col, endLine, endCol) < 0
  );
}

/** Compares source spans while tolerating relative/absolute file-path forms. */
export function sameInteractionSpan(
  left: SourceSpan,
  right: SourceSpan,
): boolean {
  return (
    sameInteractionFile(left.file, right.file) &&
    left.line === right.line &&
    left.col === right.col &&
    left.endLine === right.endLine &&
    left.endCol === right.endCol
  );
}

/** Selects the smallest authored range from already-containing candidates. */
export function narrowestInteractionSpan<T>(
  values: readonly T[],
  span: (value: T) => SourceSpan,
): T | undefined {
  return [...values].sort(
    (left, right) => spanSize(span(left)) - spanSize(span(right)),
  )[0];
}

/** Merges loop-unrolled source links without losing concrete target identity. */
export function deduplicateInteractionLinks(
  links: InteractionSourceLink[],
): InteractionSourceLink[] {
  const merged = new Map<string, InteractionSourceLink>();
  for (const link of links) {
    const span = link.span;
    const key = `${normalizePath(span.file)}:${span.line}:${span.col}:${span.endLine}:${span.endCol}`;
    const existing = merged.get(key);
    merged.set(
      key,
      existing
        ? {
            kind: link.kind,
            span,
            entityIds: [...new Set([...existing.entityIds, ...link.entityIds])],
            topologyIds: [
              ...new Set([...existing.topologyIds, ...link.topologyIds]),
            ],
          }
        : link,
    );
  }
  return [...merged.values()];
}

/** Tests whether two source paths identify the same snapshot file. */
export function sameInteractionFile(left: string, right: string): boolean {
  const a = normalizePath(left);
  const b = normalizePath(right);
  return a === b || a.endsWith(`/${b}`) || b.endsWith(`/${a}`);
}

/**
 * Normalizes path into the canonical form.
 */
function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^file:\/\//, '')
    .toLowerCase();
}

/**
 * Compares using the requested criteria.
 */
function compare(
  leftLine: number,
  leftCol: number,
  rightLine: number,
  rightCol: number,
): number {
  return leftLine === rightLine ? leftCol - rightCol : leftLine - rightLine;
}

/**
 * Handles span size in the metadata flow.
 */
function spanSize(span: SourceSpan): number {
  return (
    ((span.endLine ?? span.line) - span.line) * 100_000 +
    (span.endCol ?? span.col) -
    span.col
  );
}
