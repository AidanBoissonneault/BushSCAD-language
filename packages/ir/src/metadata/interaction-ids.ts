/**
 * @author Aidan Boissonneault
 * @file interaction-ids.ts
 * @purpose Provides interaction ids behavior for the metadata in IR package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '../shared/ir-core.js';

/**
 * Handles normalized file in the metadata flow.
 */
function normalizedFile(file: string): string {
  return file.replace(/\\/g, '/');
}

/** Builds a deterministic identity component from a complete source span. */
export function interactionSpanKey(span: SourceSpan): string {
  return [
    normalizedFile(span.file),
    span.line,
    span.col,
    span.endLine ?? span.line,
    span.endCol ?? span.col,
  ].join(':');
}

/**
 * Creates a readable stable ID without relying on evaluation or mesh order.
 * Generated instances remain stable through transport when their authored
 * range and evaluator-provided instance path remain unchanged.
 */
export function interactionId(
  category: string,
  entrypoint: string,
  span: SourceSpan,
  logicalName: string,
  instancePath = '',
): string {
  return [
    category,
    normalizedFile(entrypoint),
    interactionSpanKey(span),
    logicalName,
    instancePath,
  ]
    .map((part) => encodeURIComponent(part))
    .join('|');
}
