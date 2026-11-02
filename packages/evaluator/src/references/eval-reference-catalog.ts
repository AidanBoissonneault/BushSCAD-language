/**
 * @author Aidan Boissonneault
 * @file eval-reference-catalog.ts
 * @purpose Evaluates reference catalog for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { EvalCtx } from '../core/eval-types.js';

const TERMINAL_SEGMENTS = new Set([
  'edges',
  'center',
  'perimeter',
  'width',
  'height',
  'length',
  'area',
  'normal',
]);

/** Returns all concrete geometry labels currently visible to selectors. */
export function knownReferenceLabels(ctx: EvalCtx): string[] {
  return [...ctx.faceMetrics.keys(), ...ctx.solidMetrics.keys()];
}

/**
 * Reports whether concrete selector parts identify known geometry or a valid
 * topology-producing continuation.
 * Wildcard expansion must consider synthetic terminal selectors such as
 * `.edges` in addition to directly measured face and solid labels.
 */
export function knownReferenceExists(parts: string[], ctx: EvalCtx): boolean {
  const label = parts.join('.');
  if (ctx.faceMetrics.has(label) || ctx.solidMetrics.has(label)) return true;

  const terminal = parts[parts.length - 1] ?? '';
  const parent = parts.slice(0, -1).join('.');
  if (TERMINAL_SEGMENTS.has(terminal) && ctx.faceMetrics.has(parent)) {
    return true;
  }

  const prefix = label ? `${label}.` : '';
  return knownReferenceLabels(ctx).some(
    (known) =>
      known === label || (prefix.length > 0 && known.startsWith(prefix)),
  );
}
